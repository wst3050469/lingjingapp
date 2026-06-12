import urllib.request, json

# Test cloud file list via HTTPS
req = urllib.request.Request('https://ide.zhejiangjinmo.com/api/files/list?path=/root/cloud-server',
    headers={'x-api-key': 'lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8'})
resp = urllib.request.urlopen(req, timeout=5)
data = json.loads(resp.read())
print(f'Cloud API: {len(data["entries"])} files OK')

# Test APK
req2 = urllib.request.Request('https://ide.zhejiangjinmo.com/downloads/lingjing-v1.73.0.apk', method='HEAD')
resp2 = urllib.request.urlopen(req2, timeout=5)
print(f'APK: HTTP {resp2.status}, {int(resp2.headers["Content-Length"])//1048576}MB')
