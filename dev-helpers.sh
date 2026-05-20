#!/bin/bash
# Quick dev commands for LingJing IDE
# Usage: source dev-helpers.sh

# Git
alias gs="git status"
alias gl="git log --oneline -10"
alias gpull="git pull server main"
alias gpush="git push origin main"
alias gsync="git pull server main && git push origin main"

# Sync dist to electron node_modules
alias sync-core="rsync -a packages/core/dist/ packages/electron/node_modules/@codepilot/core/dist/"

# Build
alias build-renderer="cd packages/renderer && pnpm build"
alias build-electron="cd packages/electron && node scripts/build-main.mjs"

# Full chain: electron build (includes sync-core + sync-renderer)
alias build-all="cd packages/electron && node scripts/build-main.mjs"

# Linux installer
alias build-linux="cd packages/electron && node scripts/build-main.mjs && node scripts/pre-package.mjs && npx electron-builder build --linux --x64"

# NOTE: packages/core/dist/ is pre-built (43 modules).
# Running tsc rebuilds only 9/43 modules - DO NOT delete/disturb dist/.

