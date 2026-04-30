#!/usr/bin/env bash
#
# Migrate the slotly/ subtree of BHDossantos/SavoryMind into a fresh
# BHDossantos/Slotly repo at the root, preserving history.
#
# Requirements: git, git-filter-repo (pip install git-filter-repo),
# push access to the target repo, and the target repo must be empty.
#
# Override defaults via env vars: SOURCE_REMOTE, SOURCE_BRANCH,
# TARGET_REMOTE, TARGET_BRANCH.
#
# See MIGRATION.md for the explainer.
set -euo pipefail

WORK_DIR="$(mktemp -d -t slotly-migrate-XXXXXX)"
SOURCE_REMOTE="${SOURCE_REMOTE:-git@github.com:BHDossantos/SavoryMind.git}"
SOURCE_BRANCH="${SOURCE_BRANCH:-claude/appointment-booking-platform-FYizt}"
TARGET_REMOTE="${TARGET_REMOTE:-git@github.com:BHDossantos/Slotly.git}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"

echo "Cloning $SOURCE_REMOTE branch $SOURCE_BRANCH -> $WORK_DIR"
git clone --branch "$SOURCE_BRANCH" --single-branch "$SOURCE_REMOTE" "$WORK_DIR"
cd "$WORK_DIR"

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "ERROR: git-filter-repo not installed."
  echo "Install with: pip install git-filter-repo  (or: brew install git-filter-repo)"
  exit 1
fi

echo "Rewriting history: availablenow/ -> slotly/"
git filter-repo --force --path-rename availablenow/:slotly/

echo "Extracting slotly/ as the repo root"
git filter-repo --force --subdirectory-filter slotly

echo "Pushing to $TARGET_REMOTE branch $TARGET_BRANCH"
git remote add origin "$TARGET_REMOTE"
git branch -M "$TARGET_BRANCH"
git push -u origin "$TARGET_BRANCH"

echo "Done. Slotly is now at $TARGET_REMOTE on branch $TARGET_BRANCH"
echo "Working clone left at: $WORK_DIR (delete when you're satisfied with the migration)"
