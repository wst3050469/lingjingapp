async function test() {
  const keys = [
    '5379dcbe873b356430d84f3f68b0f0c6e96e2afa3b8a9b5441c9e4d7f5a0b1c2',
    'lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8'
  ];
  for (const key of keys) {
    try {
      const res = await fetch('https://ide.zhejiangjinmo.com/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          deviceId: 'test-' + Date.now(),
          deviceName: 'Test',
          deviceInfo: {platform: 'test'},
          apiKey: key
        })
      });
      const data = await res.json();
      console.log(`Key ${key.slice(0,20)}... : ${data.ok === true ? 'WORKS' : 'FAILS: ' + JSON.stringify(data)}`);
    } catch(e) {
      console.log(`Key ${key.slice(0,20)}... : ERROR: ${e.message}`);
    }
  }
}
test();
