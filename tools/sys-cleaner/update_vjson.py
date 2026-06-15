import json
with open('/var/www/html/versions.json') as f:
    data = json.load(f)

data['latest'] = '1.73.82'
data['releaseDate'] = '2026-06-15'
data['releaseNotes'] = 'v1.73.82: sys-cleaner system maintenance tool + stability'

v182 = {
    'version': '1.73.82', 'releaseDate': '2026-06-15', 'status': 'published',
    'files': {
        'win-x64': {'url': '/downloads/1.73.82/LingJing-Portable-1.73.82-win-x64.exe',
                     'size': 194701948,
                     'sha512': '26ce6911326199a03799d46fad3bee92819029df591ab1eb2615a961bc282e9550cde2807a90834d7f676c903d4df16963f69ff87de96206c13c8a0239c5c9cd',
                     'type': 'portable'},
        'win-setup': {'url': '/downloads/1.73.82/灵境 Setup 1.73.82.exe',
                       'size': 195043501, 'type': 'setup'}
    },
    'platforms': {
        'win-x64': {'url': '/downloads/1.73.82/LingJing-Portable-1.73.82-win-x64.exe',
                     'size': 194701948,
                     'sha512': '26ce6911326199a03799d46fad3bee92819029df591ab1eb2615a961bc282e9550cde2807a90834d7f676c903d4df16963f69ff87de96206c13c8a0239c5c9cd',
                     'type': 'portable'}
    }
}
data['versions'].insert(0, v182)

entries = [
    {'type': 'win-portable', 'version': '1.73.82', 'url': 'https://lingjing.zhejiangjinmo.com/downloads/1.73.82/LingJing-Portable-1.73.82-win-x64.exe', 'size': 194701948},
    {'type': 'win-setup', 'version': '1.73.82', 'url': 'https://lingjing.zhejiangjinmo.com/downloads/1.73.82/灵境 Setup 1.73.82.exe', 'size': 195043501}
]
for e in entries:
    data['entries'].insert(0, e)

with open('/var/www/html/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('updated')
