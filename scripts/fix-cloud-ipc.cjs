const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'packages', 'electron', 'src', 'ipc', 'cloud-ipc.ts');
let content = fs.readFileSync(filePath, 'utf8');

const NL = '\n';

// ============================================================
// Fix 1: cloud:connect - Move event listeners before connectWebSocket
// ============================================================
const oldBlock1 = [
  '      // Auto-register for JWT',
  '      const registered = await cloudClient.autoRegister();',
  '      if (!registered) {',
  "        console.warn('[Cloud] autoRegister failed, will still try WebSocket');",
  '      }',
  '',
  '      // Connect WebSocket',
  '      cloudClient.connectWebSocket();',
  '',
  '      // Wait for WebSocket connection to be established',
  '      const wsConnected = await Promise.race([',
  '        new Promise(resolve => {',
  "          cloudClient!.on('connected', () => resolve(true));",
  '        }),',
  '        new Promise((_, reject) =>',
  "          setTimeout(() => reject(new Error('WebSocket connection timeout after 10s')), 10000)",
  '        ),',
  '      ]);',
  '',
  '      // Listen for events \u2192 push to renderer',
  "      cloudClient.on('connected', (data) => {",
  "        mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });",
  '      });',
  "      cloudClient.on('disconnected', () => {",
  "        mainWindow?.webContents.send('cloud:status', { connected: false });",
  '      });',
  "      cloudClient.on('sync', (payload) => {",
  "        mainWindow?.webContents.send('cloud:sync-event', payload);",
  '      });',
  "      cloudClient.on('webhook', (data) => {",
  "        mainWindow?.webContents.send('cloud:webhook-event', data);",
  '      });',
  "      cloudClient.on('relay:from-mobile', (data) => {",
  "        mainWindow?.webContents.send('cloud:relay:from-mobile', data);",
  '      });',
  "      cloudClient.on('desktop:list', (data) => {",
  "        mainWindow?.webContents.send('cloud:desktop:list', data);",
  '      });',
  '',
  "      const healthy = await cloudClient.healthCheck().catch(e => {",
  "        console.warn('[Cloud] healthCheck failed after WS connected:', e);",
  '        return false;',
  '      });',
  '      isConnecting = false;',
  "      return { connected: true, healthy, wsConnected, registered, deviceId: cloudClient.getDeviceId() };",
  '    } catch (err) {',
  '      isConnecting = false;',
  "      return { connected: false, error: String(err) };",
  '    }',
].join(NL);

const newBlock1 = [
  '      // Auto-register for JWT',
  '      const registered = await cloudClient.autoRegister();',
  '      if (!registered) {',
  "        console.warn('[Cloud] autoRegister failed, will still try WebSocket');",
  '      }',
  '',
  '      // \u2500\u2500 Register forwarding event listeners BEFORE connectWebSocket() \u2500\u2500',
  "      // CRITICAL BUG FIX: These must be registered BEFORE connectWebSocket() so",
  "      // they catch the initial 'connected' event emitted by the WebSocket onopen.",
  "      // Previously they were placed AFTER the Promise.race, meaning the temporary",
  "      // race listener consumed the initial event and the forwarding listeners",
  '      // were never triggered, leaving the renderer with stale connection status.',
  "      cloudClient.on('connected', (data) => {",
  "        mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });",
  '      });',
  "      cloudClient.on('disconnected', () => {",
  "        mainWindow?.webContents.send('cloud:status', { connected: false });",
  '      });',
  "      cloudClient.on('sync', (payload) => {",
  "        mainWindow?.webContents.send('cloud:sync-event', payload);",
  '      });',
  "      cloudClient.on('webhook', (data) => {",
  "        mainWindow?.webContents.send('cloud:webhook-event', data);",
  '      });',
  "      cloudClient.on('relay:from-mobile', (data) => {",
  "        mainWindow?.webContents.send('cloud:relay:from-mobile', data);",
  '      });',
  "      cloudClient.on('desktop:list', (data) => {",
  "        mainWindow?.webContents.send('cloud:desktop:list', data);",
  '      });',
  '',
  '      // Connect WebSocket (the connected event will be caught by listeners above)',
  '      cloudClient.connectWebSocket();',
  '',
  '      // Wait for WebSocket connection to be established (10s timeout)',
  '      const wsConnected = await Promise.race([',
  '        new Promise(resolve => {',
  "          cloudClient!.on('connected', () => resolve(true));",
  '        }),',
  '        new Promise((_, reject) =>',
  "          setTimeout(() => reject(new Error('WebSocket connection timeout after 10s')), 10000)",
  '        ),',
  '      ]);',
  '',
  "      const healthy = await cloudClient.healthCheck().catch(e => {",
  "        console.warn('[Cloud] healthCheck failed after WS connected:', e);",
  '        return false;',
  '      });',
  '      isConnecting = false;',
  '      return { connected: true, healthy, wsConnected, registered, deviceId: cloudClient.getDeviceId() };',
  '    } catch (err) {',
  '      isConnecting = false;',
  "      console.error('[Cloud] cloud:connect failed:', err instanceof Error ? (err.stack || err.message) : String(err));",
  "      return { connected: false, error: String(err) };",
  '    }',
].join(NL);

// Check: replace the arrow character in oldBlock1 to ensure match
// The actual file has \u2192 (right arrow) in "// Listen for events → push to renderer"
if (!content.includes(oldBlock1)) {
  // Try with the actual arrow character
  const altOldBlock1 = oldBlock1.replace('// Listen for events \u2192 push to renderer', '// Listen for events \u2192 push to renderer');
  if (content.includes(altOldBlock1)) {
    console.log('Fix 1: arrow char matches in alt check');
  }
  
  // Find what's different around the arrow line
  const arrowIdx = content.indexOf('// Listen for events');
  if (arrowIdx >= 0) {
    const snippet = content.slice(arrowIdx, arrowIdx + 50);
    console.log('Arrow line in file:', JSON.stringify(snippet));
  }
}

if (content.includes(oldBlock1)) {
  content = content.replace(oldBlock1, newBlock1);
  console.log('Fix 1 applied: cloud:connect event listener order fixed');
} else {
  console.log('Fix 1 NOT MATCHED');
  // Show what the first character diff is
  const idx = content.indexOf('// Auto-register for JWT');
  for (let i = 0; i < oldBlock1.length; i++) {
    if (content[idx + i] !== oldBlock1[i]) {
      console.log('First diff at offset', i, 'expected char code', oldBlock1.charCodeAt(i), 'got', content.charCodeAt(idx + i));
      console.log('Context:', JSON.stringify(oldBlock1.slice(Math.max(0,i-10), i+10)));
      console.log('File:   ', JSON.stringify(content.slice(idx + Math.max(0,i-10), idx + i + 10)));
      break;
    }
  }
}

// ============================================================
// Fix 2: cloud:set-user-token - same pattern
// ============================================================
const oldBlock2 = [
  '    cloudClient.setToken(token);',
  "    logger.info('[Cloud] User JWT bound to sync client');",
  '    ',
  '    // Connect WebSocket with user token',
  '    cloudClient.connectWebSocket();',
  '    ',
  '    // Set up event listeners',
  "    cloudClient.on('connected', (data) => {",
  "      mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });",
  '    });',
  "    cloudClient.on('disconnected', () => {",
  "      mainWindow?.webContents.send('cloud:status', { connected: false });",
  '    });',
  "    cloudClient.on('sync', (payload) => {",
  "      mainWindow?.webContents.send('cloud:sync-event', payload);",
  '    });',
  "    cloudClient.on('webhook', (data) => {",
  "      mainWindow?.webContents.send('cloud:webhook-event', data);",
  '    });',
  "    cloudClient.on('relay:from-mobile', (data) => {",
  "      mainWindow?.webContents.send('cloud:relay:from-mobile', data);",
  '    });',
  "    cloudClient.on('desktop:list', (data) => {",
  "      mainWindow?.webContents.send('cloud:desktop:list', data);",
  '    });',
  '',
  '    // Wait for WebSocket to connect (max 10s)',
  '    const wsConnected = await Promise.race([',
  '      new Promise<boolean>(resolve => {',
  '        cloudClient!.on("connected", () => resolve(true));',
  '      }),',
  '      new Promise<boolean>(resolve =>',
  '        setTimeout(() => resolve(false), 10000)',
  '      ),',
  '    ]);',
  '',
  "    const healthy = wsConnected ? await cloudClient!.healthCheck().catch(() => false) : false;",
  "    return { ok: true, connected: wsConnected, healthy, deviceId: cloudClient!.getDeviceId() };",
].join(NL);

const newBlock2 = [
  '    cloudClient.setToken(token);',
  "    logger.info('[Cloud] User JWT bound to sync client');",
  '',
  '    // \u2500\u2500 Register forwarding event listeners BEFORE connectWebSocket() \u2500\u2500',
  "    cloudClient.on('connected', (data) => {",
  "      mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });",
  '    });',
  "    cloudClient.on('disconnected', () => {",
  "      mainWindow?.webContents.send('cloud:status', { connected: false });",
  '    });',
  "    cloudClient.on('sync', (payload) => {",
  "      mainWindow?.webContents.send('cloud:sync-event', payload);",
  '    });',
  "    cloudClient.on('webhook', (data) => {",
  "      mainWindow?.webContents.send('cloud:webhook-event', data);",
  '    });',
  "    cloudClient.on('relay:from-mobile', (data) => {",
  "      mainWindow?.webContents.send('cloud:relay:from-mobile', data);",
  '    });',
  "    cloudClient.on('desktop:list', (data) => {",
  "      mainWindow?.webContents.send('cloud:desktop:list', data);",
  '    });',
  '    ',
  '    // Connect WebSocket with user token (event listeners already registered above)',
  '    cloudClient.connectWebSocket();',
  '    ',
  '    // Wait for WebSocket to connect (max 10s)',
  '    const wsConnected = await Promise.race([',
  '      new Promise<boolean>(resolve => {',
  '        cloudClient!.on("connected", () => resolve(true));',
  '      }),',
  '      new Promise<boolean>(resolve =>',
  '        setTimeout(() => resolve(false), 10000)',
  '      ),',
  '    ]);',
  '',
  "    const healthy = wsConnected ? await cloudClient!.healthCheck().catch(() => false) : false;",
  "    return { ok: true, connected: wsConnected, healthy, deviceId: cloudClient!.getDeviceId() };",
].join(NL);

if (content.includes(oldBlock2)) {
  content = content.replace(oldBlock2, newBlock2);
  console.log('Fix 2 applied: cloud:set-user-token event listener order fixed');
} else {
  console.log('Fix 2 NOT MATCHED');
}

// ============================================================
// Fix 3: autoConnectCloud - same pattern
// ============================================================
const oldBlock3 = [
  "      // Try WebSocket directly \u2014 don't gate on health check",
  '      // (health check may fail due to firewall/proxy while WebSocket works)',
  '      cloudClient.connectWebSocket();',
  '',
  '      // Set up event listeners',
  "      cloudClient.on('connected', (data) => {",
  "        console.log('[Cloud] WebSocket connected');",
  "        mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });",
  '      });',
  "      cloudClient.on('disconnected', () => {",
  "        console.log('[Cloud] WebSocket disconnected');",
  "        mainWindow?.webContents.send('cloud:status', { connected: false });",
  '      });',
  "      cloudClient.on('sync', (payload) => {",
  "        mainWindow?.webContents.send('cloud:sync-event', payload);",
  '      });',
  "      cloudClient.on('webhook', (data) => {",
  "        mainWindow?.webContents.send('cloud:webhook-event', data);",
  '      });',
  "      cloudClient.on('relay:from-mobile', (data) => {",
  "        mainWindow?.webContents.send('cloud:relay:from-mobile', data);",
  '      });',
  "      cloudClient.on('desktop:list', (data) => {",
  "        mainWindow?.webContents.send('cloud:desktop:list', data);",
  '      });',
].join(NL);

const newBlock3 = [
  '      // \u2500\u2500 Register forwarding event listeners BEFORE connectWebSocket() \u2500\u2500',
  "      cloudClient.on('connected', (data) => {",
  "        console.log('[Cloud] WebSocket connected');",
  "        mainWindow?.webContents.send('cloud:status', { connected: true, url: data.url, deviceId: cloudClient?.getDeviceId() });",
  '      });',
  "      cloudClient.on('disconnected', () => {",
  "        console.log('[Cloud] WebSocket disconnected');",
  "        mainWindow?.webContents.send('cloud:status', { connected: false });",
  '      });',
  "      cloudClient.on('sync', (payload) => {",
  "        mainWindow?.webContents.send('cloud:sync-event', payload);",
  '      });',
  "      cloudClient.on('webhook', (data) => {",
  "        mainWindow?.webContents.send('cloud:webhook-event', data);",
  '      });',
  "      cloudClient.on('relay:from-mobile', (data) => {",
  "        mainWindow?.webContents.send('cloud:relay:from-mobile', data);",
  '      });',
  "      cloudClient.on('desktop:list', (data) => {",
  "        mainWindow?.webContents.send('cloud:desktop:list', data);",
  '      });',
  '',
  "      // Try WebSocket directly \u2014 don't gate on health check",
  '      // (health check may fail due to firewall/proxy while WebSocket works)',
  '      cloudClient.connectWebSocket();',
].join(NL);

if (content.includes(oldBlock3)) {
  content = content.replace(oldBlock3, newBlock3);
  console.log('Fix 3 applied: autoConnectCloud event listener order fixed');
} else {
  console.log('Fix 3 NOT MATCHED');
}

// ============================================================
// Write result
// ============================================================
if (content !== fs.readFileSync(filePath, 'utf8')) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\nFile written successfully');
} else {
  console.log('\nNo changes made (content unchanged)');
}
