#!/usr/bin/env bash
# Packs the app into a zip file next to the project folder, e.g.
# ../teardown-bot-20261031-14-05-09.zip, ready to share or upload to GitHub.
# The date and time in the name mean earlier zips are never overwritten.
# (Hyphens, not colons, between hours, minutes and seconds: macOS Finder
# and Windows can't show colons in file names.)
#
#   bash scripts/zip.sh
#
# Anything listed in .gitignore (node_modules, .next, .env.local with your
# keys...) is left out. The zip holds a single teardown-bot/ folder.

set -euo pipefail
cd "$(dirname "$0")/.."

name="$(basename "$PWD")"
zipname="$name-$(date +%Y%m%d-%H-%M-%S).zip"

# Ask git which files .gitignore allows. A throwaway empty repository is used,
# so this works whether or not the project is itself a git repository.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git --git-dir="$tmp" init -q
git --git-dir="$tmp" --work-tree=. ls-files --others --exclude-standard | sed "s|^|$name/|" > "$tmp/files.txt"

(cd .. && zip -q "$zipname" -@ < "$tmp/files.txt")

echo "Created $(cd .. && pwd)/$zipname with $(wc -l < "$tmp/files.txt" | tr -d ' ') files."
