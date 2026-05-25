import WebSocket from 'ws';
const ws = new WebSocket('wss://ide.zhejiangjinmo.com/ws?api_key=lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8');
ws.on('open', () => {
  console.log('WS CONNECTED OK');
  ws.close();
  process.exit(0);
});
ws.on('error', (err) => {
  console.log('WS ERROR:', err.message);
  process.exit(1);
});
ws.on('close', (code, reason) => {
  console.log('WS CLOSED:', code, reason?.toString());
});
setTimeout(() => {
  console.log('TIMEOUT - No connection after 10s');
  process.exit(1);
}, 10000);
