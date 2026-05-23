import hashlib, base64, os

files = [
    '/var/www/downloads/LingJing-1.52.7-linux-x86_64.AppImage',
    '/var/www/downloads/LingJing-1.52.7-linux-x86_64.deb'
]

for f in files:
    h = hashlib.sha512()
    with open(f, 'rb') as fp:
        for chunk in iter(lambda: fp.read(65536), b''):
            h.update(chunk)
    b64 = base64.b64encode(h.digest()).decode()
    sz = os.path.getsize(f)
    name = os.path.basename(f)
    print(f'{name}: sha512={b64} size={sz}')
