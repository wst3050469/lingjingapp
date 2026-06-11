import json, urllib.request
resp = urllib.request.urlopen('https://ide.zhejiangjinmo.com/versions.json')
data = json.loads(resp.read())
print('Latest:', data['latest'])
v0 = data['versions'][0]
print('Files:', list(v0['files'].keys()))
print('android:', v0['files'].get('android'))
