#!/usr/bin/env bash
# One-step setup for running Teardown Bot on your own computer (macOS or Linux).
# Safe to run again: it skips anything that is already installed.
#
#   bash scripts/setup.sh
#
# It installs nvm (a tool that manages Node versions), the Node version named
# in .nvmrc, and yarn (the tool that installs the app's code libraries). It then
# installs those libraries, creates .env.local for your keys, and runs the tests.

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n==> %s\n' "$1"; }

step "Checking for nvm"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm not found. Installing it..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"
echo "nvm $(nvm --version)"

# .nvmrc is a hidden file, so it can get lost when the project is copied or
# zipped. package.json names the same version, so rebuild it from there.
if [ ! -f .nvmrc ]; then
  sed -n 's/.*"node": *"\([0-9][0-9]*\).*/\1/p' package.json | head -n 1 > .nvmrc
  echo "Created .nvmrc from package.json."
fi

step "Installing Node $(cat .nvmrc) (skipped if already installed)"
nvm install >/dev/null
nvm use >/dev/null
echo "node $(node -v)"

step "Checking for yarn"
if ! command -v yarn >/dev/null 2>&1; then
  echo "yarn not found for this Node version. Installing it..."
  npm install -g yarn >/dev/null
fi
echo "yarn $(yarn -v)"

step "Installing the app's libraries"
yarn install --frozen-lockfile

step "Checking for .env.local (where your keys live)"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local. Open it and paste in your ANTHROPIC_API_KEY."
else
  echo ".env.local already exists. Leaving it alone."
fi

step "Running tests"
yarn test

cat <<'EOF'

Setup complete.

Next steps:
  1. Put your key in .env.local (ANTHROPIC_API_KEY=sk-ant-...)
  2. Start the app:   yarn dev
  3. Open http://localhost:3000 in your browser. Press Ctrl+C in the terminal to stop it.

If "yarn" or "node" isn't found in a new terminal window, run:  nvm use
EOF
