import subprocess

# Step 1: Check if admin-api.js has normalization code
r = subprocess.run(
    ["ssh", "root@120.55.5.220", 
     "grep -c 'normalizePlatformNames' /root/cloud-server/admin-api.js 2>/dev/null || echo 0"],
    capture_output=True, text=True, timeout=10, encoding='utf-8'
)
print("normalizePlatformNames in admin-api.js:", r.stdout.strip())

# Step 2: Restart cloud-server
r2 = subprocess.run(
    ["ssh", "root@120.55.5.220", "pm2 restart cloud-server"],
    capture_output=True, text=True, timeout=15, encoding='utf-8'
)
print("PM2 restart:", r2.stdout.strip() or r2.stderr.strip())

# Step 3: Check if previous Linux build env exists
r3 = subprocess.run(
    ["ssh", "root@120.55.5.220",
     "ls /root/lingjing-build/desktop/electron/package.json 2>/dev/null && echo EXISTS || echo NOT_FOUND"],
    capture_output=True, text=True, timeout=10, encoding='utf-8'
)
print("Build env:", r3.stdout.strip())

# Step 4: Check if we can find any previous build workspace
r4 = subprocess.run(
    ["ssh", "root@120.55.5.220",
     "find /root -maxdepth 3 -name 'electron-builder.json' 2>/dev/null | head -5"],
    capture_output=True, text=True, timeout=10, encoding='utf-8'
)
print("Builder configs found:", r4.stdout.strip() or "(none)")
