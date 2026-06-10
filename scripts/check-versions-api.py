import urllib.request, json
d = json.loads(urllib.request.urlopen('http://localhost:8000/api/versions').read())
for v in d['versions'][:5]:
    files = v.get('files', {})
    print(f"{v['version']:10s} status={v.get('status','?'):14s} platforms={list(files.keys())}")
