import json

# Load authoritative version from downloads
with open('/var/www/downloads/versions.json') as f:
    data = json.load(f)

# Remove duplicate entries
seen = set()
unique = []
for v in data['versions']:
    if v['version'] not in seen:
        seen.add(v['version'])
        unique.append(v)
data['versions'] = unique

# Ensure latest points to first version
data['latest'] = unique[0]['version']

# Write to BOTH paths (Nginx serves from /var/www/html/)
paths = [
    '/var/www/html/versions.json',
    '/var/www/downloads/versions.json',
]
for p in paths:
    with open(p, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print(f'Synced {len(unique)} unique versions. latest={data["latest"]}')

# Verify versions match
for p in paths:
    with open(p) as f:
        d = json.load(f)
    print(f'{p}: latest={d["latest"]}, total={len(d["versions"])}')
