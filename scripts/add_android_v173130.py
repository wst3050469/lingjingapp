import json

with open('/var/www/downloads/versions.json') as f:
    data = json.load(f)

# Find v1.73.130 entry and add android
for v in data.get('versions', []):
    if v['version'] == '1.73.130':
        v['files']['android'] = {
            'url': '/downloads/v1.73.130/LingJing-Mobile-1.73.130.apk',
            'size': 86581179,
            'sha512': '036d3cf97fa7d4b1ded3d0127e13cd7d9ce8cefb5178247ab0e9790e91e2cbf6f03570a5acc4c8daaaab5ae82edffe74381f33dc3f7913d82a323a9d741fd129'
        }
        break

with open('/var/www/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('Android entry added to v1.73.130')
