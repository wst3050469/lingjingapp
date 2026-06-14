import subprocess

# Verify local admin-api.js syntax
out, err = subprocess.Popen(
    ["node", "-c", "D:/lingjing-ide/services/backend/admin-api.js"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
).communicate()
print("Syntax check:", "OK" if not err else err.decode()[:200])

# Deploy admin-api.js
r = subprocess.run(
    ["scp", "D:/lingjing-ide/services/backend/admin-api.js", 
     "root@120.55.5.220:/root/cloud-server/admin-api.js"],
    capture_output=True, timeout=30
)
print("SCP admin-api:", "OK" if r.returncode == 0 else r.stderr.decode()[:200])

# Verify deployment
r2 = subprocess.run(
    ["ssh", "root@120.55.5.220", "grep -c normalizePlatformNames /root/cloud-server/admin-api.js"],
    capture_output=True, timeout=10
)
print("Verification - normalizePlatformNames:", r2.stdout.decode().strip())

# Verify file size
r3 = subprocess.run(
    ["ssh", "root@120.55.5.220", "wc -l /root/cloud-server/admin-api.js"],
    capture_output=True, timeout=10
)
print("Lines:", r3.stdout.decode().strip())

# Restart cloud-server
r4 = subprocess.run(
    ["ssh", "root@120.55.5.220", "pm2 restart cloud-server 2>&1"],
    capture_output=True, timeout=15
)
out4 = r4.stdout.decode('utf-8', errors='replace')
err4 = r4.stderr.decode('utf-8', errors='replace')
print("PM2 restart:", out4[:200] or err4[:200])
