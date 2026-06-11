import json, urllib.request

# Fetch versions.json from multiple paths
urls = [
    'https://ide.zhejiangjinmo.com/versions.json',
    'https://ide.zhejiangjinmo.com/api/latest',
]
for url in urls:
    print(f'\n=== {url} ===')
    resp = urllib.request.urlopen(url)
    data = json.loads(resp.read())
    print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])

print('\n=== /var/www/html/versions.json ===')
with open('/var/www/html/versions.json') as f:
    d = json.load(f)
    print('latest:', d['latest'])
    v0 = d['versions'][0]
    print('v0.version:', v0['version'])
    print('v0.files:', v0.get('files', {}))

print('\n=== /var/www/downloads/versions.json ===')
with open('/var/www/downloads/versions.json') as f:
    d = json.load(f)
    print('latest:', d['latest'])
    v0 = d['versions'][0]
    print('v0.version:', v0['version'])
    print('v0.files:', v0.get('files', {}))

print('\n=== latest.yml ===')
with open('/var/www/downloads/latest.yml') as f:
    print(f.read())

print('\n=== latest-linux.yml ===')
with open('/var/www/downloads/latest-linux.yml') as f:
    print(f.read())
