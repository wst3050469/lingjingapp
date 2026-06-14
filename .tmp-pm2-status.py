import subprocess, json

r = subprocess.run(["ssh", "root@120.55.5.220", "pm2 jlist"], 
                   capture_output=True, timeout=15)

with open('D:/lingjing-ide/.tmp-pm2.json', 'wb') as f:
    f.write(r.stdout)

# Parse and display
try:
    data = json.loads(r.stdout)
    for p in data:
        name = p.get('name', '?')
        status = p.get('pm2_env', {}).get('status', '?')
        restarts = p.get('pm2_env', {}).get('restart_time', 0)
        print(f"{name}: {status} (restarts: {restarts})")
except Exception as e:
    print("Parse error:", e)
    print("First 200 bytes:", r.stdout[:200])
