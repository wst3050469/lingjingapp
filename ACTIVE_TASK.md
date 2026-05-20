# LingJing IDE - Task Tracker

## Current Status: v1.46.3 Deployed (All Platforms)

### Latest Version: v1.46.3
Release: Fix ghost exports (RuleLoader, runIndexingPipeline, createLogger) + Windows/Linux/Android full deploy

### Changes in v1.46.3
- Removed 3 ghost exports from dist/index.js (RuleLoader, runIndexingPipeline, createLogger)
- Replaced with PipelineEngine, DslParser, TriggerManager, logger
- Fixed CRLF/encoding issues in package.json files
- All 32 exports validated by validate-exports.mjs
- Windows Setup & Portable built and deployed (141MB each)
- Linux AppImage & deb built and deployed
- APK symlinked to match version (v1.46.3 -> v1.46.0)
- nginx: fixed /downloads/latest.yml 404 (^~ prefix), added favicon.ico + min-version.txt

### Git Status
- Local: 64d7852f0 OK
- Server: 64d7852f0 OK
- GitHub: 64d7852f0 OK

### Service Health
- PM2: 4/4 online
- Disk: 24% (109G free)
- nginx: config clean, all 9 endpoints 200
- tsc: zero errors
- core exports: 32/32 validated

### Development Environment
- Linux workstation (192.168.1.9): code-server v4.118.0 on port 8088
- VS Code extensions installed: ESLint, Prettier, GitLens, TS Next, Mermaid, zh-cn
- Workspace: lingjing.code-workspace
- Samba share: \\192.168.1.9\lingjing-ide
- auto-build CI: cron running, SCP path bug fixed
