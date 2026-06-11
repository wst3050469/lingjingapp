import urllib.request, json
req = urllib.request.Request('http://localhost:8000/api/mobile/chat',
    data=json.dumps({'message':'hi'}).encode(),
    headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req)
print(json.loads(resp.read()))
