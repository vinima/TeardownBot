import assert from "node:assert";
import { htmlToText, embeddedText, isBotCheck, chunkText, selectChunks } from "./retrieve.ts";

const html = `<html><head><style>.x{}</style><script>alert(1)</script></head>
<body><h1>Ship faster with Acme</h1><p>Acme is the frontend cloud for developers &amp; teams.</p>
<p>Pricing starts free. Pro is $20 per user per month with usage-based bandwidth.</p></body></html>`;

const text = htmlToText(html);
assert.ok(text.includes("Ship faster with Acme"));
assert.ok(!text.includes("alert"), "scripts removed");
assert.ok(text.includes("developers & teams"), "entities decoded");

// A page built by JavaScript: nothing visible, but text hidden in tags and data.
const spa = `<html><head><title>Acme</title>
<meta name="description" content="Acme is the frontend cloud for developers &amp; teams.">
<meta property="og:title" content='Acme: ship faster'>
<meta property="og:image" content="https://acme.com/og.png">
<script type="application/ld+json">{"@type":"Product","name":"Acme","description":"Deploy previews for every pull request, free for hobby projects."}</script>
<script id="__NEXT_DATA__" type="application/json">{"props":{"hero":"The fastest way to put your app online","cls":"flex items-center justify-between px-4","id":"abc123"}}</script>
<script>window.app = "Should not be read by anyone at all"</script>
</head><body><div id="root"></div></body></html>`;
assert.ok(htmlToText(spa).split(/\s+/).length < 30, "visible text is thin");
const hidden = embeddedText(spa);
assert.ok(hidden.includes("developers & teams"), "meta description read and decoded");
assert.ok(hidden.includes("Acme: ship faster"), "social-share title read");
assert.ok(hidden.includes("Deploy previews for every pull request"), "JSON-LD read");
assert.ok(hidden.includes("The fastest way to put your app online"), "__NEXT_DATA__ read");
assert.ok(!hidden.includes("items-center"), "style names skipped");
assert.ok(!hidden.includes("og.png") && !hidden.includes("Should not"), "images and plain scripts skipped");

assert.ok(isBotCheck(`<html><head><title>Just a moment...</title></head><body><script src="/cdn-cgi/challenge-platform/x.js"></script></body></html>`));
assert.ok(!isBotCheck(html), "normal page is not a bot check");

const long = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
const chunks = chunkText("https://a.com", long, 180, 40);
assert.equal(chunks.length, 4);
assert.ok(chunks[0].text.split(" ").length === 180);

const filler = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(" ");

// Menus and footers are dropped; the main content and page title are kept.
const site = `<html><head><title>Acme pricing</title></head><body>
<nav>Products Docs Pricing Login</nav>
<main><h1>Plans for every team</h1><p>${filler(100, "body")}</p><nav>Breadcrumb nav</nav></main>
<footer>Copyright Acme Careers</footer></body></html>`;
const siteText = htmlToText(site);
assert.ok(siteText.includes("Acme pricing") && siteText.includes("Plans for every team"), "title and main kept");
assert.ok(!siteText.includes("Login") && !siteText.includes("Breadcrumb") && !siteText.includes("Careers"), "menus and footer dropped");
// ...but not when <main> holds almost nothing, which would lose the page.
const thinMain = `<html><body><nav>Menu</nav><main><p>Hi</p></main><section>${filler(100, "real")}</section></body></html>`;
assert.ok(htmlToText(thinMain).includes("real99"), "falls back when <main> is nearly empty");

// Pages that fit the budget are sent whole, without overlapping chunks.
const small = [
  { url: "https://acme.com", text: "Acme homepage hero ship faster frontend cloud" },
  { url: "https://acme.com/pricing", text: "Pricing plans Pro costs $20 per user per month" },
];
const all = selectChunks(small, "Who is the buyer?");
assert.equal(all.length, 2, "everything sent when it fits, even with no keyword match");

// Over budget: each page's opening chunk, then the best matches, in page order.
const big = [
  { url: "https://acme.com", text: "Acme homepage hero ship faster frontend cloud " + filler(400, "home") },
  { url: "https://acme.com/pricing", text: filler(300, "intro") + " Pricing plans Pro costs $20 per user per month " + filler(300, "more") },
  { url: "https://acme.com/docs", text: filler(400, "docs") },
];
const picked = selectChunks(big, "How much does the Pro plan cost per user?", 800);
const words = picked.reduce((n, c) => n + c.text.split(" ").length, 0);
assert.ok(words <= 800, "stays within the budget");
assert.ok(picked.some((c) => c.text.includes("Pro costs")), "best-matching chunk included");
for (const p of big) assert.ok(picked.some((c) => c.url === p.url && c.text.startsWith(p.text.split(" ")[0])), `opener of ${p.url} included`);
assert.deepEqual(picked.map((c) => c.url), [...picked.map((c) => c.url)].sort((a, b) => big.findIndex((p) => p.url === a) - big.findIndex((p) => p.url === b)), "page order kept");

console.log("All retrieval tests passed");
