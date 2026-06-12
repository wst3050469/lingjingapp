import urllib.request, json

print("=== versions.json (Nginx) ===")
resp = urllib.request.urlopen("https://ide.zhejiangjinmo.com/versions.json", timeout=5)
data = json.loads(resp.read())
v0 = data['versions'][0]
print("latest:", data['latest'])
print("v0.version:", v0['version'])
print("v0.files:")
for k, v in v0.get('files', {}).items():
    print(f"  {k}: {v}")

print()
print("=== Download URL tests ===")
urls = [
    "https://ide.zhejiangjinmo.com/downloads/灵境 Setup 1.72.31.exe",
    "https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.72.31-win-x64.exe",
    "https://ide.zhejiangjinmo.com/LingJing-Setup-1.72.31-win-x64.exe",
]
for url in urls:
    try:
        req = urllib.request.Request(url, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=5)
        print(f"  {resp.status} {resp.headers.get('Content-Length','?')} {url.split('/')[-1][:50]}")
    except Exception as e:
        print(f"  FAIL {url.split('/')[-1][:50]}: {type(e).__name__}")

print()
print("=== latest.yml (direct) ===")
resp = urllib.request.urlopen("https://ide.zhejiangjinmo.com/downloads/latest.yml", timeout=5)
for line in resp.read().decode()[:300].split('\n'):
    print(line)
