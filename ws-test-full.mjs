// Full simulation of the cloud sync connection flow
import WebSocket from 'ws';

const BASE = 'https://ide.zhejiangjinmo.com';
const API_KEY = 'lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8';

async function main() {
  // Step 1: Health check
  console.log('=== 1. Health Check ===');
  try {
    const res = await fetch(`${BASE}/api/health`);
    const data = await res.json();
    console.log('Health:', JSON.stringify(data));
  } catch (e) {
    console.log('Health FAILED:', e.message);
  }

  // Step 2: Register device (same as sync-client.ts does)
  console.log('\n=== 2. Device Registration ===');
  let token;
  try {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'test-sim-' + Date.now().toString(36),
        deviceName: 'Test Simulation',
        deviceInfo: {
          platform: 'win32',
          arch: 'x64',
          nodeVersion: process.version,
          clientVersion: '2.0.0',
        },
        apiKey: API_KEY,
      }),
    });
    const data = await res.json();
    console.log('Register response:', JSON.stringify(data, null, 2));
    if (data.token) {
      token = data.token;
      console.log('Got token:', token.slice(0, 20) + '...');
    } else {
      console.log('NO TOKEN in response!');
    }
  } catch (e) {
    console.log('Register FAILED:', e.message);
  }

  if (!token) {
    console.log('\n❌ Cannot proceed without token');
    process.exit(1);
  }

  // Step 3: Connect WebSocket with token
  console.log('\n=== 3. WebSocket Connection (with token) ===');
  await new Promise((resolve, reject) => {
    const wsUrl = BASE.replace('https://', 'wss://') + '/ws?token=' + encodeURIComponent(token) + '&device_id=test-sim-device';
    console.log('Connecting to:', wsUrl.slice(0, 60) + '...');
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully with token!');
      ws.send(JSON.stringify({ type: 'ping' }));
      console.log('Sent ping');
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('Received message type:', msg.type);
      if (msg.type === 'pong') {
        console.log('✅ Pong received - bidirectional communication works!');
        ws.close();
        resolve();
      }
    });
    
    ws.on('error', (err) => {
      console.log('❌ WebSocket error:', err.message);
      reject(err);
    });
    
    ws.on('close', (code, reason) => {
      console.log('WebSocket closed:', code, reason?.toString() || '');
    });
    
    setTimeout(() => {
      console.log('❌ Timeout waiting for pong');
      reject(new Error('Timeout'));
    }, 10000);
  });

  // Step 4: Test API call with token
  console.log('\n=== 4. API Call with Token ===');
  try {
    const res = await fetch(`${BASE}/api/sessions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('Sessions API status:', res.status);
    const data = await res.json();
    console.log('Sessions:', Array.isArray(data) ? `${data.length} items` : JSON.stringify(data).slice(0, 100));
  } catch (e) {
    console.log('Sessions API FAILED:', e.message);
  }

  // Step 5: Now try connecting with API_KEY (without token - same as initial connect)
  console.log('\n=== 5. WebSocket Connection (with api_key, no token) ===');
  await new Promise((resolve, reject) => {
    const wsUrl = BASE.replace('https://', 'wss://') + '/ws?api_key=' + encodeURIComponent(API_KEY);
    console.log('Connecting to:', wsUrl.slice(0, 60) + '...');
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully with api_key!');
      ws.close();
      resolve();
    });
    
    ws.on('error', (err) => {
      console.log('❌ WebSocket error:', err.message);
      reject(err);
    });
    
    setTimeout(() => {
      console.log('❌ Timeout');
      reject(new Error('Timeout'));
    }, 10000);
  });

  console.log('\n✅ ALL TESTS PASSED');
}

main().catch(err => {
  console.log('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
