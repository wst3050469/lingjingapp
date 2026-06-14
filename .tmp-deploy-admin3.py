import subprocess, sys

# Just deploy and verify - no PM2 restart
r = subprocess.run(
    ["scp", "D:/lingjing-ide/services/backend/admin-api.js", 
     "root@120.55.5.220:/root/cloud-server/admin-api.js"],
    capture_output=True, timeout=30
)
print("SCP:", "OK" if r.returncode == 0 else "FAIL")

r2 = subprocess.run(
    ["ssh", "root@120.55.5.220", "grep -c normalizePlatformNames /root/cloud-server/admin-api.js"],
    capture_output=True, timeout=10
)
count = r2.stdout.decode().strip()
print("normalizePlatformNames:", count)

r3 = subprocess.run(
    ["ssh", "root@120.55.5.220", "node -e \"require('/root/cloud-server/admin-api.js')\" 2>&1"],
    capture_output=True, timeout=10
)
print("Node check:", r3.stderr.decode('utf-8', errors='replace')[:200] or "OK")
