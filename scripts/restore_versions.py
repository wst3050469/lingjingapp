import json

# Read backup (has v1.73.110 → v1.73.119)
with open('/var/www/downloads/versions.json.bak') as f:
    data = json.load(f)

# Read current (has v1.73.129, v1.73.130)
with open('/var/www/downloads/versions.json') as f:
    current = json.load(f)

# Get existing versions from backup
backup_versions = {v['version']: v for v in data.get('versions', [])}

# Get current versions
current_versions = {v['version']: v for v in current.get('versions', [])}

# Merge: current versions override backup
merged = {**backup_versions, **current_versions}

# Sort by version number (descending)
def version_key(v):
    parts = v.replace('v', '').split('.')
    return tuple(int(p) for p in parts)

sorted_versions = sorted(merged.values(), key=lambda v: version_key(v['version']), reverse=True)

# Keep last 15 versions to avoid file bloat
kept = sorted_versions[:15]

data['versions'] = kept
data['latest'] = current['latest']  # v1.73.130

with open('/var/www/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'Restored {len(kept)} versions, latest: {data["latest"]}')
for v in kept:
    print(f"  {v['version']} ({v.get('status', 'published')})")
