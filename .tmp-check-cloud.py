import subprocess

# Check if cloud-server is responding
r = subprocess.run(
    ["ssh", "root@120.55.5.220", 
     "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/health"],
    capture_output=True, timeout=10
)
print("cloud-server HTTP:", r.stdout.decode().strip())

# Check PM2 list
r2 = subprocess.run(
    ["ssh", "root@120.55.5.220", "pm2 list 2>/dev/null | grep cloud-server"],
    capture_output=True, timeout=10
)
out = r2.stdout.decode('ascii', errors='replace')
# Just show the status column
parts = out.split()
if 'online' in parts:
    print("cloud-server status: online")
else:
    print("cloud-server raw:", out[:200])
