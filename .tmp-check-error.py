import subprocess

# Get cloud-server error logs
r = subprocess.run(
    ["ssh", "root@120.55.5.220", "pm2 logs cloud-server --lines 10 --nostream 2>&1"],
    capture_output=True, timeout=15
)
data = r.stdout.decode('utf-8', errors='replace')
print("Cloud-server logs:")
for line in data.split('\n')[-15:]:
    print(line)

# Also check: does admin-api.js parse correctly?
r2 = subprocess.run(
    ["ssh", "root@120.55.5.220", "node --check /root/cloud-server/admin-api.js 2>&1"],
    capture_output=True, timeout=10
)
print("\nSyntax check:", r2.stderr.decode()[:300] or "OK")
