import urllib.request, json

try:
    resp = urllib.request.urlopen("http://localhost:8000/api/health", timeout=5)
    print("cloud-server local:", resp.read().decode())
except Exception as e:
    print("cloud-server local FAILED:", e)

try:
    resp = urllib.request.urlopen("https://ide.zhejiangjinmo.com/api/latest", timeout=5)
    print("api/latest HTTPS:", resp.read().decode()[:200])
except Exception as e2:
    print("api/latest HTTPS FAILED:", e2)

try:
    resp = urllib.request.urlopen("https://ide.zhejiangjinmo.com/api/health", timeout=5)
    print("api/health HTTPS:", resp.read().decode())
except Exception as e3:
    print("api/health HTTPS FAILED:", e3)

try:
    resp = urllib.request.urlopen("https://ide.zhejiangjinmo.com/downloads/latest.yml", timeout=5)
    print("latest.yml HTTPS:", resp.read().decode()[:100])
except Exception as e4:
    print("latest.yml HTTPS FAILED:", e4)
