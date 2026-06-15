import json, sys

VERSION = sys.argv[1] if len(sys.argv) > 1 else '1.73.80'
SIZE_PORTABLE = 194709406
SIZE_SETUP = 195050906
SHA512 = '00fedc84ab10fe1cc3f63648826095eb351d6163f93a1334fdaa4069ade01101c7e75525e24742c59030c79ec160aefa3102f93c957cfbf0ea50474754663798'

with open('/var/www/html/versions.json', 'r') as f:
    d = json.load(f)

d['latest'] = VERSION
d['releaseDate'] = '2026-06-15'
d['releaseNotes'] = f'v{VERSION}: 升级稳定性增强 - 缓存+崩溃防护+URL预探测+智能重试'

new_entry = {
    'version': VERSION,
    'releaseDate': '2026-06-15',
    'status': 'published',
    'files': {
        'win-x64': {
            'url': f'/downloads/{VERSION}/LingJing-Portable-{VERSION}-win-x64.exe',
            'size': SIZE_PORTABLE,
            'sha512': SHA512,
            'type': 'portable'
        },
        'win-setup': {
            'url': f'/downloads/{VERSION}/灵境 Setup {VERSION}.exe',
            'size': SIZE_SETUP,
            'type': 'setup'
        }
    },
    'platforms': {
        'win-x64': {
            'url': f'/downloads/{VERSION}/LingJing-Portable-{VERSION}-win-x64.exe',
            'size': SIZE_PORTABLE,
            'sha512': SHA512,
            'type': 'portable'
        }
    }
}
d['versions'].insert(0, new_entry)

with open('/var/www/html/versions.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)

print(f'OK: latest={d["latest"]}')
