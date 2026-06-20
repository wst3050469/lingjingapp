import hashlib, os

ver = '1.73.131'
base = '/var/www/downloads/v1.73.131'

def b64_sha512(path):
    raw = hashlib.sha512(open(path, 'rb').read()).digest()
    import base64
    return base64.b64encode(raw).decode()

setup_path = f'{base}/LingJing-Setup-{ver}-win-x64.exe'
portable_path = f'{base}/LingJing-Portable-{ver}-win-x64.exe'
linux_path = f'{base}/LingJing-{ver}-linux-x86_64.AppImage'
deb_path = f'{base}/LingJing-{ver}-linux-x86_64.deb'
apk_path = f'{base}/LingJing-Mobile-{ver}.apk'

# latest.yml (Windows)
latest_yml = f"""version: {ver}
files:
  - url: LingJing-Setup-{ver}-win-x64.exe
    sha512: {b64_sha512(setup_path)}
    size: {os.path.getsize(setup_path)}
  - url: LingJing-Portable-{ver}-win-x64.exe
    sha512: {b64_sha512(portable_path)}
    size: {os.path.getsize(portable_path)}
path: LingJing-Setup-{ver}-win-x64.exe
sha512: {b64_sha512(setup_path)}
releaseDate: '2026-06-20T00:00:00.000Z'
"""

# latest-linux.yml
latest_linux_yml = f"""version: {ver}
files:
  - url: LingJing-{ver}-linux-x86_64.AppImage
    sha512: {b64_sha512(linux_path)}
    size: {os.path.getsize(linux_path)}
  - url: LingJing-{ver}-linux-x86_64.deb
    sha512: {b64_sha512(deb_path)}
    size: {os.path.getsize(deb_path)}
path: LingJing-{ver}-linux-x86_64.AppImage
sha512: {b64_sha512(linux_path)}
releaseDate: '2026-06-20T00:00:00.000Z'
"""

for fname, content in [('latest.yml', latest_yml), ('latest-linux.yml', latest_linux_yml)]:
    for d in ['/var/www/downloads', '/var/www/html/downloads']:
        path = f'{d}/{fname}'
        with open(path, 'w') as f:
            f.write(content)
        print(f'Updated: {path}')

print('Done!')
