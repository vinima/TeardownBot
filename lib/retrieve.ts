// Turns web pages into text chunks and picks the ones the AI reads.
// When there's too much to send whole, this is the "R" (retrieval) in RAG.

export type Chunk = { url: string; text: string };

// 1. Strip a web page down to readable text: its main content, without
//    menus and footers. A trim is kept only if it leaves at least 30% of the
//    words, because some sites put little inside <main> (render.com keeps 17
//    of its 829 words there).
export function htmlToText(html: string): string {
  const full = toText(html);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const main = html.match(/<main\b[\s\S]*<\/main>/i)?.[0];
  const trims = [main && `<title>${title}</title>${withoutMenus(main)}`, withoutMenus(html)];
  for (const trim of trims) {
    if (!trim) continue;
    const text = toText(trim);
    if (wordCount(text) >= 0.3 * wordCount(full)) return text;
  }
  return full;
}

function withoutMenus(html: string): string {
  return html.replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, " ");
}

function toText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// 1b. Fallback for pages whose visible text is built by JavaScript. Such
//     pages still carry some text for search engines and their own scripts:
//     the meta description, social-share tags, structured data (JSON-LD)
//     and embedded JSON such as Next.js's __NEXT_DATA__. htmlToText throws
//     all of that away, so collect it here.
export function embeddedText(html: string): string {
  const found: string[] = [];

  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const name = attr(tag, "name") || attr(tag, "property");
    if (name && /^(description|og:title|og:description|twitter:title|twitter:description)$/i.test(name)) {
      found.push(decodeEntities(attr(tag, "content")));
    }
  }

  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/application\/(ld\+)?json|__NEXT_DATA__/i.test(attrs)) continue;
    try {
      collectProse(JSON.parse(body), found);
    } catch {
      // Not valid JSON; skip it.
    }
  }

  return [...new Set(found.map((s) => s.trim()).filter(Boolean))].join("\n");
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[1] ?? m[2]) : "";
}

// Walk a JSON value and keep the strings that read like sentences.
// Embedded JSON is mostly settings, IDs and style names, which would
// only add noise.
function collectProse(value: unknown, out: string[]) {
  if (typeof value === "string") {
    const text = value.includes("<") ? htmlToText(value) : value;
    if (looksLikeProse(text)) out.push(text);
  } else if (Array.isArray(value)) {
    for (const v of value) collectProse(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectProse(v, out);
  }
}

function looksLikeProse(s: string): boolean {
  const words = s.trim().split(/\s+/);
  if (words.length < 4 || /^https?:\/\//.test(s)) return false;
  // Mostly ordinary words, so "flex items-center px-4" style names fail.
  const plain = words.filter((w) => /^[A-Za-z][a-z'’]*[.,!?;:]?$/.test(w)).length;
  return plain / words.length >= 0.6;
}

// 1c. Recognise the "checking your browser" pages that bot-protection
//     services (Cloudflare, Vercel) send instead of the real page.
export function isBotCheck(html: string): boolean {
  return /challenge-platform|cf_chl|<title>\s*Just a moment|Vercel Security Checkpoint|verifying your browser/i.test(html);
}

// 2. Cut text into overlapping pieces of roughly `size` words.
export function chunkText(url: string, text: string, size = 180, overlap = 40): Chunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: Chunk[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push({ url, text: words.slice(i, i + size).join(" ") });
    if (i + size >= words.length) break;
  }
  return chunks;
}

const STOPWORDS = new Set(
  "a an and are as at be by for from how i in is it of on or that the this to was what when where which who why will with you your does do can their they its".split(" ")
);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// 3. Choose the chunks the AI reads, up to `budget` words in total.
//    If all the pages fit, send everything: questions like "who is the
//    buyer?" rarely share words with the page, so ranking would only throw
//    away evidence. Otherwise rank chunks against the question and fill the
//    budget with the best, always starting with each page's opening chunk
//    (usually the headline and pitch).
export function selectChunks(pages: { url: string; text: string }[], question: string, budget = 12_000): Chunk[] {
  const total = pages.reduce((n, p) => n + wordCount(p.text), 0);
  if (total <= budget) return pages.flatMap((p) => chunkText(p.url, p.text, 180, 0));

  const chunks = pages.flatMap((p) => chunkText(p.url, p.text));
  const scores = bm25(chunks, question);
  let pos = 0;
  const posInPage = chunks.map((c, i) => (pos = i > 0 && chunks[i - 1].url === c.url ? pos + 1 : 0));
  const openers = chunks.filter((_, i) => posInPage[i] === 0);
  // Best score first. Ties (including "no match at all") go to chunks
  // nearer the top of their page, so every page gets its share.
  const ranked = chunks
    .map((c, i) => ({ c, i }))
    .sort((x, y) => scores[y.i] - scores[x.i] || posInPage[x.i] - posInPage[y.i] || x.i - y.i)
    .map((x) => x.c);

  const picked = new Set<Chunk>();
  let words = 0;
  for (const c of [...openers, ...ranked]) {
    if (picked.has(c)) continue;
    const n = wordCount(c.text);
    if (words + n > budget) break;
    picked.add(c);
    words += n;
  }
  return chunks.filter((c) => picked.has(c)); // back in page order
}

// Score each chunk against the question with BM25, a classic keyword-search
// formula: rarer question words count for more, repeats help a little.
function bm25(chunks: Chunk[], question: string): number[] {
  const q = [...new Set(tokens(question))];
  const docs = chunks.map((c) => tokens(c.text));
  const avgLen = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const term of q) df.set(term, docs.filter((d) => d.includes(term)).length);

  const k1 = 1.4, b = 0.75, N = docs.length;
  return docs.map((d) => {
    let score = 0;
    for (const term of q) {
      const tf = d.filter((t) => t === term).length;
      if (!tf) continue;
      const idf = Math.log(1 + (N - df.get(term)! + 0.5) / (df.get(term)! + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.length) / avgLen)));
    }
    return score;
  });
}
