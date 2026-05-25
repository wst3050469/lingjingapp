const { execSync } = require('child_process');
execSync('git add -A', { cwd: __dirname + '/..', stdio: 'inherit' });
execSync('git commit -m "v1.58.1: fix cloud sync event listener ordering bug

Three critical event listener ordering fixes in cloud-ipc.ts:
- cloud:connect: register forwarding listeners before connectWebSocket()
- cloud:set-user-token: register forwarding listeners before connectWebSocket()
- autoConnectCloud: register forwarding listeners before connectWebSocket()

Root cause: forwarding event listeners were registered AFTER Promise.race,
consuming the initial connected event without forwarding to renderer.
This caused the renderer to always show disconnected even when
WebSocket was actually connected."', { cwd: __dirname + '/..', stdio: 'inherit' });
