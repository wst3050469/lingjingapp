import json, urllib.request

url = 'http://localhost:3002/versions.json'
resp = urllib.request.urlopen(url)
data = json.load(resp)
latest = data['latest']
entry = [v for v in data['versions'] if v['version'] == latest][0]
rawFiles = entry.get('files', [])

print('latest:', latest)
print('files count:', len(rawFiles))

fileMap = {}
for f in rawFiles:
    p = f.get('platform', '?')
    t = f.get('type', '?')
    key = p + '_' + t
    fileMap[key] = f
    print('  key=%s -> %s' % (key, f['url'].split('/')[-1][:60]))

# Check sections
ok = True
for k in ['win-x64_setup', 'win-x64_portable', 'linux-x64_appimage', 'linux-x64_deb']:
    if k in fileMap:
        print('OK:', k)
    else:
        print('MISSING:', k)
        ok = False

print('RESULT:', 'PASS' if ok else 'FAIL')
