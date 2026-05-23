import json, urllib.request
req = urllib.request.urlopen('https://api.github.com/repos/wst3050469/lingjing/branches/main')
data = json.load(req)
print('GitHub commit:', data.get('commit', {}).get('sha', 'unknown'))
