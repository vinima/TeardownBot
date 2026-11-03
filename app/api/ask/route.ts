// The server side of the app. It receives a question and a list of web
// pages, fetches those pages, finds the most relevant passages, and asks
// an AI model to answer using only those passages.

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { htmlToText, embeddedText, isBotCheck, wordCount, selectChunks } from "@/lib/retrieve";

export const maxDuration = 60; // seconds Vercel lets this run

const MAX_URLS = 8;
const MAX_PAGE_BYTES = 2_000_000;
const CONTEXT_WORDS = 12_000; // most teardowns fit whole; on Claude Haiku that's well under a cent per question

// Picks the AI model based on which API key you added (in Vercel, or in
// .env.local when running on your own computer).
function pickModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic(process.env.MODEL || "claude-haiku-5-5");
  }
  if (process.env.OPENAI_API_KEY) {
    if (!process.env.MODEL) throw new Error("Set a MODEL environment variable to use OpenAI (for example the model name shown in your OpenAI dashboard).");
    return openai(process.env.MODEL);
  }
  throw new Error("No AI key found. Add ANTHROPIC_API_KEY (or OPENAI_API_KEY plus MODEL) in your Vercel project settings and redeploy, or, on your own computer, in .env.local and restart yarn dev.");
}

// Only allow normal public web addresses (no internal/private networks).
function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return false; // raw IPs
    return true;
  } catch {
    return false;
  }
}

const MIN_WORDS = 30; // fewer visible words than this and the page counts as unreadable
const MIN_FALLBACK_WORDS = 10; // ...unless its hidden text (see embeddedText) has at least this many

const BOT_CHECK_ERROR = "the site showed a bot check instead of the page, so it can't be read automatically";

type Page = { url: string; text?: string; error?: string; partial?: boolean };

async function fetchPage(url: string): Promise<Page> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (teardown-bot; personal research)" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { url, error: isBotCheck(body) ? BOT_CHECK_ERROR : `HTTP ${res.status}` };
    }
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html") && !type.includes("text")) return { url, error: `not a web page (${type})` };
    const body = (await res.text()).slice(0, MAX_PAGE_BYTES);
    if (!type.includes("html")) return wordCount(body) < MIN_WORDS ? { url, error: "almost no text" } : { url, text: body };

    // 1. The normal case: the page's visible text.
    const text = htmlToText(body);
    if (wordCount(text) >= MIN_WORDS) return { url, text };

    // 2. Too little visible text. Either a bot check, or a page built by
    //    JavaScript; for the latter, use the text hidden in the page.
    if (isBotCheck(body)) return { url, error: BOT_CHECK_ERROR };
    const hidden = embeddedText(body);
    if (wordCount(hidden) >= MIN_FALLBACK_WORDS) return { url, text: `${text}\n${hidden}`, partial: true };
    return { url, error: "almost no readable text, even in the page's hidden summary (it probably needs JavaScript to load)" };
  } catch (e) {
    return { url, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function POST(req: Request) {
  const started = Date.now();
  let body: { question?: string; urls?: string[]; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  // Optional password so strangers can't spend your API credits.
  if (process.env.APP_PASSWORD && body.password !== process.env.APP_PASSWORD) {
    return Response.json({ error: "Wrong or missing password." }, { status: 401 });
  }

  const question = (body.question || "").trim().slice(0, 1000);
  const urls = [...new Set((body.urls || []).map((u) => u.trim()).filter(Boolean))];
  if (!question) return Response.json({ error: "Type a question first." }, { status: 400 });
  if (urls.length === 0) return Response.json({ error: "Add at least one web page address." }, { status: 400 });
  if (urls.length > MAX_URLS) return Response.json({ error: `Use ${MAX_URLS} pages or fewer.` }, { status: 400 });
  const bad = urls.filter((u) => !isAllowedUrl(u));
  if (bad.length) return Response.json({ error: `These don't look like public web addresses: ${bad.join(", ")}` }, { status: 400 });

  const pages = await Promise.all(urls.map(fetchPage));
  const failed = pages.filter((p) => p.error).map((p) => ({ url: p.url, error: p.error! }));
  const partial = pages.filter((p) => p.partial).map((p) => p.url);
  const readable = pages.flatMap((p) => (p.text ? [{ url: p.url, text: p.text }] : []));
  if (readable.length === 0) {
    return Response.json({ error: "Couldn't read any of those pages.", failed }, { status: 422 });
  }

  const context = selectChunks(readable, question, CONTEXT_WORDS);
  const numbered = context.map((c, i) => `[${i + 1}] (${c.url})\n${c.text}`).join("\n\n");

  try {
    const { text, finishReason } = await generateText({
      model: pickModel(),
      // The limit covers the model's thinking as well as the answer, so it
      // needs plenty of room. The instructions keep the answer itself short.
      maxOutputTokens: 8000,
      system:
        "You are a sharp product-marketing analyst helping someone write a positioning teardown of a developer tool. " +
        "You are given numbered excerpts from the company's own web pages. Base claims about the company's positioning on them and cite them inline like [2]. " +
        "Answer every part of the question. If it says what to start with, the first thing in your answer must be that, taken from the excerpts if they cover it, and from outside knowledge only if they don't (then put that section first). Otherwise follow the order it asks. " +
        // Readers need a real answer to "compare it with X" even when the pages
        // are silent, but must always be able to tell the site from outside knowledge.
        "When the excerpts don't cover something the question asks for, such as naming competitors or comparing with another company, still answer it from your general knowledge, " +
        "under a heading exactly 'Outside knowledge (not from the site)'. Put all such material there, with no citations, and note that it may be out of date. " +
        "Never present outside knowledge as something the company says, and say plainly when the excerpts are silent. " +
        "Your job is analysis. Questions about persona, buyer, positioning, tone or competitors are answered by inference from evidence: " +
        "who the copy speaks to, the problems it describes, what the calls to action ask for (for example 'Contact sales' versus 'Start free'), " +
        "pricing, proof points and customer logos, and programs aimed at particular groups. " +
        "Draw a clear conclusion, give your confidence (high, medium or low), and show the evidence behind it. " +
        "Keep what the company explicitly says separate from your interpretation, and label the interpretation. " +
        "If better evidence would sit on a page you weren't given, name that page (pricing, docs, a specific product page) in one line at the end. " +
        "Be concise.",
      prompt: `Page excerpts:\n\n${numbered}\n\nQuestion: ${question}`,
    });
    // List only the excerpts the answer cites; with whole pages sent there can be dozens.
    const cited = new Set([...text.matchAll(/\[([\d,\s–-]+)\]/g)].flatMap((m) => m[1].match(/\d+/g)!.map(Number)));
    return Response.json({
      answer: text,
      truncated: finishReason === "length",
      sources: context
        .map((c, i) => ({ n: i + 1, url: c.url, preview: c.text.slice(0, 160) }))
        .filter((s) => cited.size === 0 || cited.has(s.n)),
      failed,
      partial,
      ms: Date.now() - started,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "The AI call failed.", failed, partial }, { status: 500 });
  }
}
