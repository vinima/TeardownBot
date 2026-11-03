# Teardown Bot

A small AI app that answers positioning questions about any developer tool using only that company's own web pages, with citations. Built with Next.js and the Vercel AI SDK, deployed on Vercel, and tracked with PostHog.

New here? [docs/WHAT-IT-DOES.md](docs/WHAT-IT-DOES.md) explains what the app does and how to use it. [docs/CODE-GUIDE.md](docs/CODE-GUIDE.md) explains the code and where to make common changes.

There are two ways to run it:
- **On the web with Vercel** (Steps 1–4 below). This gives you a public link you can share.
- **On your own computer** (see [Run it on your own computer](#run-it-on-your-own-computer)). Good for trying changes before you deploy them.

You don't need to write any code. You need about an hour and three free accounts. Button names on these sites change from time to time, so if something doesn't match exactly, look for the closest option. Note down where you got stuck, because that's research for your teardowns.

---

## Before you start: your friction log

Open a blank doc and keep it next to you the whole time. For every step, write:

| Time | Step | What I expected | What happened | How I got unstuck |
|---|---|---|---|---|

Screenshot anything confusing. This log is the evidence for your Vercel and PostHog teardowns.

---

## Step 1: Get an AI API key (about 10 minutes)

1. Go to console.anthropic.com and create an account.
2. Add a small amount of credit. $5 is plenty, since each question costs a fraction of a cent.
3. Create an API key and copy it somewhere safe. It starts with `sk-ant-`.

Prefer OpenAI? Use an OpenAI key instead. In Step 3 you'd add `OPENAI_API_KEY` plus a `MODEL` variable set to the model name from your OpenAI dashboard.

**Never paste your key into the code or share it.** It only goes into Vercel's settings (Step 3).

## Step 2: Put the code on GitHub (about 10 minutes)

1. Create a free account at github.com.
2. Click **New repository**. Name it `teardown-bot`, leave it Public or make it Private, and click **Create repository**.
3. On the next screen, click **uploading an existing file**.
4. Unzip `teardown-bot.zip` on your computer. Open the folder, select **everything inside it** (not the folder itself), and drag it onto the GitHub page.
   - If you've already run the app on your computer, make a clean zip first with `yarn zip` (it leaves out everything that shouldn't be uploaded). Otherwise **don't upload** `node_modules`, `.next` or `.env.local`. `.env.local` contains your API key. (Finder hides files starting with a dot, so normally they're skipped anyway.)
5. Click **Commit changes**.

Already using Claude Code with the GitHub command line tool (`gh`)? You can skip the upload and ask Claude to create a private repository and push the project to it. This project's own copy lives at `vinima/TeardownBot`.

## Step 3: Deploy on Vercel (about 10 minutes)

1. Go to vercel.com and sign up **with your GitHub account**.
2. Click **Add New → Project** and import `teardown-bot`.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your key from Step 1
   - `APP_PASSWORD` = any password you choose. This stops strangers using your API credit.
4. Click **Deploy** and wait for the confetti.
5. Open your new site, enter your password under **Password**, click the **Vercel** preset and ask a question.

Friction-log prompts: How long from sign-up to a live URL? Did anything confuse you? Did Vercel recognize the project as Next.js on its own?

**Making changes later:** once Vercel is connected, every change pushed to the `main` branch on GitHub goes live automatically within a few minutes. You don't need to do anything in Vercel. If a build fails, the previous version normally stays live. The one exception is settings: after changing an environment variable in Vercel, go to **Deployments**, open the latest one and click **Redeploy**.

## Step 4: Add PostHog (about 15 minutes)

1. Sign up at posthog.com. When asked, pick the US or EU cloud (either works).
2. Find your **Project API key**. It starts with `phc_`.
3. In Vercel, go to your project's **Settings → Environment Variables** and add:
   - `NEXT_PUBLIC_POSTHOG_KEY` = your `phc_` key
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.i.posthog.com` **only if you chose EU** (skip it for US)
4. Go to **Deployments**, open the latest one, and click **Redeploy** so the change takes effect.
5. Use your app for a few minutes, then check PostHog for events.

The app already sends these events:

| Event | When it fires |
|---|---|
| `$pageview` | Someone opens the app |
| `preset_selected` | The Vercel or PostHog preset button is clicked |
| `suggested_question_clicked` | One of the example questions is clicked |
| `question_asked` | Any question is submitted, with the number of pages and domains |
| `answer_received` / `answer_failed` | The answer comes back, with how long it took |

Things to try in PostHog for your teardown:
- Build a **funnel**: `$pageview` → `question_asked` → `answer_received`
- Watch a **session replay** of yourself using the app
- Make a chart of `answer_received` broken down by `domains`
- Note how long it took to get from sign-up to your first useful insight

---

## Run it on your own computer

This runs the same app at `http://localhost:3000`. Only you can see it, and it's handy for trying changes before deploying. You still need the API key from Step 1. These steps are for macOS or Linux. On Windows, use WSL.

**Easiest: ask Claude Code.** Open Claude Code in this folder and say *"Set up and run this app locally."* The instructions in `CLAUDE.md` tell it what to do.

**Or do it yourself:**

1. Open the **Terminal** app and go to the project folder. Type `cd `, drag the folder onto the Terminal window, and press Enter.
2. Run the setup script. It installs everything the app needs (nvm, Node 24 and yarn) if you don't have them yet, then the app's libraries, and runs the tests:
   ```
   bash scripts/setup.sh
   ```
   It's safe to run again. Anything already installed is skipped.
3. Open the file `.env.local` that the script created (in the project folder; press Cmd+Shift+. in Finder to show hidden files) and fill in your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   You can add the PostHog settings from Step 4 here too. Everything in `.env.example` is explained.
4. Start the app:
   ```
   yarn dev
   ```
   Open http://localhost:3000. Leave the Terminal window open while you use it. Press **Ctrl+C** in it to stop the app.

Next time, you only need step 4 (from the project folder). If the Terminal says `yarn: command not found`, run `nvm use` first.

| Command | What it does |
|---|---|
| `yarn dev` | Runs the app locally. Most code changes appear as soon as you save. |
| `yarn test` | Checks the retrieval code works |
| `yarn verify` | Tests plus a full production build. Run this before deploying a change. |
| `yarn zip` | Makes a zip named with today's date and time (e.g. `teardown-bot-20261031-14-05-09.zip`) next to the project folder, so earlier zips are kept, leaving out your keys and other files that shouldn't be shared |
| `yarn build` then `yarn start` | Runs the production version locally, exactly as Vercel would |

If you change `.env.local`, stop the app (Ctrl+C) and run `yarn dev` again.

## Using the app for teardowns

- Paste any company's pages (homepage, pricing, docs, a product page), one per line, up to 8.
- Ask positioning questions. Answers cite the excerpts they used, like [2], so you can check them.
- Some pages can't be fully read. Sites that load their text with JavaScript are listed as **only partly read** (the bot falls back to the page's short summary for search engines). Sites behind a bot check ("Just a moment…") can't be read at all, and are listed under pages that couldn't be read. For both, try that company's docs or blog pages instead.
- Treat answers as a research assistant's first pass, and verify anything you quote.

## How it works (for interviews)

Be ready to explain this in your own words:

1. **You send** a question and a list of web pages.
2. **The server fetches** each page and strips it down to its main text, without menus and footers (`app/api/ask/route.ts`, `lib/retrieve.ts`).
3. **It cuts the text into numbered chunks** of about 180 words. If all the pages fit within 12,000 words, which most teardowns do, **every chunk goes to the AI**. Only when there's more than that does it **rank the chunks** against your question with a keyword-scoring method called BM25 and send the best ones. That ranking is the retrieval step in RAG (retrieval-augmented generation).
4. **The AI is told to reason from the evidence**, such as who the copy speaks to, what the buttons ask for, and the customer logos. It cites a chunk for every fact, gives a confidence level, and labels its interpretation. That's why answers stay grounded instead of made up.
5. **PostHog** records what people do on the page (`app/posthog.tsx`), so you can see which questions get asked and where it fails.

A good talking point about trade-offs is why it sends everything when it can. The first version always ranked chunks by keywords. That failed on analytical questions like "who is the buyer?", because those words never appear on the page, so the AI saw only navigation menus. Sending whole pages costs a little more per question, but nothing gets lost. Keyword ranking still handles inputs that are too long. A natural next version for those is embeddings (vector search), which find passages by meaning rather than exact words.

## Files

| File | What it does |
|---|---|
| `app/page.tsx` | The page you see |
| `app/api/ask/route.ts` | Fetches pages, retrieves passages, calls the AI |
| `lib/retrieve.ts` | Turns pages into text chunks and chooses which ones the AI reads |
| `lib/retrieve.test.ts` | Checks the ranking works |
| `app/posthog.tsx` | Analytics |
| `app/globals.css` | Styling |
| `scripts/setup.sh` | Sets up the app to run on your computer |
| `scripts/zip.sh` | Packs the app into a zip to share (`yarn zip`) |
| `.env.example` | Template for your local settings file, `.env.local` |
| `docs/` | What the app does, and a guide to the code |
| `CLAUDE.md` | Instructions for Claude Code when it works on this app |

More detail, including how to make common changes, is in [docs/CODE-GUIDE.md](docs/CODE-GUIDE.md).
