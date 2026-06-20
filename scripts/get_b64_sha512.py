import hashlib, base64, sys

for path in sys.argv[1:]:
    h = hashlib.sha512(open(path, 'rb').read()).digest()
    print(f"{path}: {base64.b64encode(h).decode()}")
