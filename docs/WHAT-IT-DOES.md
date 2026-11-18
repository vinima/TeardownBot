# What Teardown Bot does

Teardown Bot is a research assistant for **positioning teardowns**, meaning write-ups of how a company describes its product, who it's aimed at, and how it handles pricing and competitors.

You give it a few of a company's web pages and ask a question. It reads those pages and answers from what they say, with numbered citations so you can check each claim. If you ask for something the pages don't cover, such as a comparison with another company, it answers that part from the AI's general knowledge, in a section headed **Outside knowledge (not from the site)**. That section has no citations and may be out of date, so check it before relying on it.

## Who it's for

People researching how developer-tool companies market themselves, for example to prepare for product-marketing interviews or to write competitive analyses.

## Using it

1. **Pages to read**: paste up to 8 web addresses, one per line. The **Vercel** and **PostHog** buttons fill in a ready-made set (homepage, pricing, docs). The Vercel set also includes Vercel's four comparison guides (vs Netlify, Render, Railway and Northflank), because that's where Vercel talks about competitors. Clicking a button replaces whatever is in the box, so add any extra pages after clicking it.
2. **Your question**: type a question, or click one of the suggested ones.
3. **Password**: only needed if whoever runs the app set one (`APP_PASSWORD`).
4. Click **Ask**. After 5 to 20 seconds you get:
   - **The answer**, with citations like `[2]`.
   - **Excerpts cited**: the numbered passages the answer cites, each with a link to its page. The numbers match the answer, so `[20]` in the answer is number 20 in the list. Gaps are normal, because excerpts the answer didn't use aren't listed.
   - A warning if the answer **was cut short** because it got too long.
   - **Pages only partly read**, if any: pages that build their text with JavaScript. For these the bot could only use the short summary the page includes for search engines and link previews.
   - **Pages that couldn't be read**, if there were any, with the reason.

## Good questions to ask

- Who is the primary persona, and who is the buyer?
- What's the one-sentence positioning, in the company's own words?
- Which competitors or alternatives does the site position against?
- How does pricing handle cost anxiety for a solo developer?
- What does the site promise about time to first value?

The bot reasons from evidence on the pages: who the copy speaks to, the problems it describes, what the buttons ask for ("Contact sales" versus "Start free"), pricing, and customer logos. So it can answer "who is the buyer?" even when no page says so directly. It gives a conclusion with a confidence level (high, medium or low), cites the evidence, and keeps what the company **says** separate from its own **interpretation**.

## Limits to know about

| Limit | Why | What to do |
|---|---|---|
| Some pages are "only partly read" | Those sites load their text with JavaScript, which the bot doesn't run. It falls back to the one or two sentences the page includes for search engines | Fine for "what's the pitch?" questions. For anything more, try the company's docs, blog or changelog pages, which are usually plain pages |
| Some pages "showed a bot check" | The site's bot protection (often Cloudflare) sends a "checking your browser" page instead of the real one | Nothing in the app can get past this today. Try a different page on the same site |
| Some pages have "almost no readable text" | Usually an app or login screen with no text even for search engines | Use the company's marketing pages instead |
| Long inputs are trimmed | The bot reads every page in full up to about 12,000 words in total, which covers most sets of 3–8 marketing pages. Beyond that it picks the passages that best match your question's words | For big inputs (long docs pages), use fewer pages, or phrase questions with words the site would use (for example "pricing", "free tier", "enterprise") |
| It says the excerpts are silent, or uses "Outside knowledge" | The pages you listed don't cover that part of your question. The bot only reads the pages you list, so it won't find a company's comparison pages by itself | Add the page that would have the answer. For competitors, look for the company's comparison or migration guides (Vercel's are at addresses like `vercel.com/kb/guide/vercel-vs-netlify`) |
| At most 8 pages per question | Keeps it fast and cheap | Ask several narrower questions |
| No memory between questions | Each question is answered fresh | Include any context in the question itself |

Treat answers as a first draft from a research assistant, and **check anything you quote** against the linked page.

## Cost

Each question makes one call to the AI model (Claude Haiku by default). Even a full 12,000 words of pages costs well under a cent, so $5 of credit lasts a very long time.

## Privacy

- The pages you list are fetched by the app's server, not your browser.
- The question and excerpts go to the AI provider (Anthropic or OpenAI).
- If PostHog is set up, it records page views, button clicks, timings and which domains were asked about, and may record session replays. Without a PostHog key, nothing is tracked.
