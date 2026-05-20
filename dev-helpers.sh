#!/bin/bash
# Quick dev commands for LingJing IDE
# Usage: source dev-helpers.sh

alias gs="git status"
alias gl="git log --oneline -10"
alias gpull="git pull server main"
alias gpush="git push origin main"
alias gsync="git pull server main && git push origin main"
alias build-core="cd packages/core && npx tsc"
alias build-renderer="cd packages/renderer && pnpm build" 
alias build-electron="cd packages/electron && node scripts/build-main.mjs"
alias build-all="build-core && build-renderer && build-electron"
alias build-linux="cd packages/electron && npx electron-builder build --linux --x64"

