import json

path = '/var/www/downloads/versions.json'
with open(path) as f:
    data = json.load(f)

for v in data['versions']:
    platforms = v.get('platforms', {})
    # Remove 'android' and 'mobile' platform entries
    platforms.pop('mobile', None)
    platforms.pop('android', None)
    # Also remove from inside any platform entry (cleanup contamination)
    for pk, pv in list(platforms.items()):
        if isinstance(pv, dict):
            pv.pop('mobile', None)
            pv.pop('android', None)

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')

# Validate
with open(path) as f:
    json.load(f)

print('OK - mobile/android entries removed from all versions')
