import urllib.request, json

for port, name in [(3000, 'update-server'), (3002, 'lingjing-update'), (8000, 'cloud')]:
    try:
        url = f'http://localhost:{port}/api/versions'
        if port == 8000:
            url = 'http://localhost:8000/api/version'
        req = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=5)
        data = json.loads(resp.read())
        if isinstance(data, dict):
            latest = data.get('latest', data.get('version', 'N/A'))
        elif isinstance(data, list) and len(data) > 0:
            latest = data[0].get('version', 'N/A')
        else:
            latest = str(data)[:50]
        print(f'{name} (:{port}): latest = {latest}')
    except Exception as e:
        print(f'{name} (:{port}): ERROR - {e}')
