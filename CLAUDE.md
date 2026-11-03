@AGENTS.md

# Teardown Bot

A Next.js app that answers positioning questions about a company from its own web pages, with citations (page text, BM25-ranked only when it exceeds the context budget, then one LLM call). It deploys on Vercel and also runs locally.

**The owner is not a programmer.** Explain what you're doing in plain language, define any jargon you have to use, and prove changes work yourself (run `yarn verify`, and use the running app for anything visible) rather than asking them to check code.

## Local setup and run

Each Bash call is a fresh non-interactive shell where nvm isn't loaded. Start every command that needs node or yarn with:

```
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use >/dev/null
```

1. **Setup**: run `bash scripts/setup.sh` from the project root. It installs nvm, the Node version in `.nvmrc`, and yarn if they're missing, then runs `yarn install --frozen-lockfile`, creates `.env.local` from `.env.example`, and runs the tests. Done when it prints `Setup complete.` If it fails, do the failing step by hand: the script is short and each step is labelled.
2. **Key**: done when `.env.local` has a non-empty `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` plus `MODEL`). Ask the owner to paste the key into the file themselves. Keep keys out of the chat and out of every committed file.
3. **Run**: start `yarn dev` in the background. Done when `curl -s localhost:3000` returns the page containing `Teardown Bot` and a POST to `/api/ask` returns an `answer`:
   ```
   curl -s -X POST localhost:3000/api/ask -H 'content-type: application/json' \
     -d '{"question":"What is the positioning?","urls":["https://posthog.com"]}'
   ```
   Then tell the owner to open http://localhost:3000.

## Making and deploying changes

The code lives in the private GitHub repository `vinima/TeardownBot`. Vercel watches its `main` branch, so **pushing to `main` publishes to the live site**. There is no separate deploy command, and no Vercel login is needed.

1. Make the change, including its docs, and run `yarn verify`. For anything visible, check it in the running app.
2. Tell the owner in plain language what changed and that it passed. Commit and push only when they say so ("deploy it", or "make this change and deploy it").
3. Commit, then `git push origin main`.
4. Confirm the result from GitHub, where Vercel reports back: `gh api repos/vinima/TeardownBot/deployments` lists deployments, and each one's `statuses_url` gives its state and site address. Tell the owner whether it succeeded. If it failed, explain why, and fix it if they want. They'd rather hear this than be asked to read logs.

Changing a Vercel setting (Settings → Environment Variables) doesn't take effect until the owner redeploys from Vercel's **Deployments** page. Keys are entered by the owner in Vercel, never through the chat.

## Conventions

- **yarn 1 only.** `yarn.lock` is the lockfile. Add libraries with `yarn add`. Keep `package-lock.json` out of the project, because two lockfiles confuse Vercel's install. Yarn 1 doesn't install peer dependencies, so when a library warns about an unmet peer, add it explicitly (that's why `zod` is listed). Script names must avoid yarn 1's built-in commands (`check`, `audit`, `info`…), which take over a script with the same name.
- **Node version** lives in two places that must agree: `.nvmrc` (local) and `engines.node` in `package.json` (Vercel).
- Variables prefixed `NEXT_PUBLIC_` are shipped to the browser. Secrets go only in unprefixed variables.
- Before saying a change is finished, run `yarn verify` (tests + production build) and get it passing.
- **Docs are part of the change.** When behaviour, settings, files or commands change, update the matching doc in the same change: `README.md` (setup and deploy steps), `docs/WHAT-IT-DOES.md` (user-facing behaviour and limits), `docs/CODE-GUIDE.md` (file map, settings table, "common changes" table). Write them for a non-programmer.
- The code favours short files with plain-English comments that explain *why*. Match that.
- For how the code fits together and where to make common edits, read `docs/CODE-GUIDE.md`.
