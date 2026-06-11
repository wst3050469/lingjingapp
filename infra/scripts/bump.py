import json, os, sys

# Repo root = two levels up from this script (infra/scripts/bump.py)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

VERSION = sys.argv[1] if len(sys.argv) > 1 else '1.72.11'
VERSION_CODE = int(sys.argv[2]) if len(sys.argv) > 2 else 57

files = [
    'mobile/package.json',
    'mobile/app.json',
    'desktop/electron/package.json',
    'desktop/frontend/package.json',
    'desktop/core/package.json',
]

for f in files:
    if not os.path.exists(f):
        print(f'SKIP (missing): {f}')
        continue
    with open(f) as fh:
        d = json.load(fh)
    if 'expo' in d:
        d['expo']['version'] = VERSION
        d['expo']['versionCode'] = VERSION_CODE
    if 'version' in d:
        d['version'] = VERSION
    with open(f, 'w') as fh:
        json.dump(d, fh, indent=2)
    print(f'OK: {f} → {d.get("version","?")}')
