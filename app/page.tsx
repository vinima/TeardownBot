"use client";
// The page you see in the browser.

import { useState } from "react";
import { track } from "./posthog";

const PRESETS: Record<string, string[]> = {
  // Vercel keeps its head-to-head comparisons in its knowledge base, not on
  // the homepage, so the competitor guides are included here.
  Vercel: [
    "https://vercel.com",
    "https://vercel.com/pricing",
    "https://vercel.com/docs",
    "https://vercel.com/kb/guide/vercel-vs-netlify",
    "https://vercel.com/kb/guide/vercel-vs-render",
    "https://vercel.com/kb/guide/vercel-vs-railway",
    "https://vercel.com/kb/guide/vercel-vs-northflank",
  ],
  PostHog: ["https://posthog.com", "https://posthog.com/pricing", "https://posthog.com/docs"],
};

const QUESTIONS = [
  "Who is the primary persona on this site, and who is the buyer?",
  "What is the one-sentence positioning, in the company's own words?",
  "What alternatives or competitors does the site position against?",
  "How does pricing handle cost anxiety for a solo developer?",
  "What does the site promise about time to first value?",
];

type Result = {
  answer?: string;
  truncated?: boolean;
  sources?: { n: number; url: string; preview: string }[];
  failed?: { url: string; error: string }[];
  partial?: string[];
  error?: string;
  ms?: number;
};

export default function Home() {
  const [urls, setUrls] = useState(PRESETS.Vercel.join("\n"));
  const [question, setQuestion] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function ask(q = question) {
    if (!q.trim()) return;
    setQuestion(q);
    setLoading(true);
    setResult(null);
    const list = urls.split(/\s+/).filter(Boolean);
    const domains = [...new Set(list.map((u) => { try { return new URL(u).hostname; } catch { return "invalid"; } }))];
    track("question_asked", { pages: list.length, domains });
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, urls: list, password }),
      });
      const data: Result = await res.json();
      setResult(data);
      track(data.error ? "answer_failed" : "answer_received", { ms: data.ms, error: data.error, truncated: data.truncated, domains });
    } catch {
      setResult({ error: "Couldn't reach the server. Check your connection and try again." });
      track("answer_failed", { error: "network" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">Positioning research</p>
        <h1>Teardown Bot</h1>
        <p className="lede">Ask how a developer tool positions itself. Answers come from the pages you list, with citations. Anything else is labelled as outside knowledge.</p>
      </header>

      <section className="card">
        <div className="row">
          <label htmlFor="urls">Pages to read</label>
          <div className="presets">
            {Object.keys(PRESETS).map((name) => (
              <button key={name} type="button" className="chip" onClick={() => { setUrls(PRESETS[name].join("\n")); track("preset_selected", { preset: name }); }}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <textarea id="urls" rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="One web address per line" />

        <label htmlFor="q">Your question</label>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="ask">
          <input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Who is this product really for?" />
          <button type="submit" disabled={loading || !question.trim()}>{loading ? "Reading…" : "Ask"}</button>
        </form>

        <div className="suggestions">
          {QUESTIONS.map((q) => (
            <button key={q} type="button" className="chip" disabled={loading} onClick={() => { track("suggested_question_clicked", { question: q }); ask(q); }}>{q}</button>
          ))}
        </div>

        <details>
          <summary>Password</summary>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Only needed if you set APP_PASSWORD" />
        </details>
      </section>

      {loading && <p className="status">Fetching pages and reading them…</p>}

      {result && (
        <section className="card result">
          {result.error ? (
            <p className="error">{result.error}</p>
          ) : (
            <>
              <div className="answer">{result.answer}</div>
              {result.truncated && <p className="error">The answer was cut short because it hit the length limit. Try a narrower question.</p>}
              {result.ms && <p className="meta">Answered in {(result.ms / 1000).toFixed(1)}s</p>}
              <h2>Excerpts cited</h2>
              <ol className="sources">
                {/* Only cited excerpts are listed, so keep each one's own number to match the answer's [n]. */}
                {result.sources?.map((s) => (
                  <li key={s.n} value={s.n}>
                    <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
                    <span>{s.preview}…</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {!!result.partial?.length && (
            <div className="failed">
              <h2>Pages only partly read</h2>
              <p className="meta">These load their text with JavaScript, so only their short summary for search engines could be used.</p>
              <ul>{result.partial.map((u) => <li key={u}>{u}</li>)}</ul>
            </div>
          )}
          {!!result.failed?.length && (
            <div className="failed">
              <h2>Pages that couldn&apos;t be read</h2>
              <ul>{result.failed.map((f) => <li key={f.url}>{f.url}: {f.error}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
