import subprocess, sys

# Simple SSH test
r = subprocess.run(
    ["ssh", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes", 
     "root@120.55.5.220", "echo CONNECTED && node -v && which pnpm"],
    capture_output=True, text=True, timeout=15, encoding='utf-8'
)
print("SSH:", r.stdout.strip())
print("ERR:", r.stderr[:200])
