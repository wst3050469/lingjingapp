import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
r = subprocess.run(["ssh", "root@120.55.5.220", "pm2 restart cloud-server"], 
                   capture_output=True, timeout=15)
print(r.stdout.decode('utf-8', errors='replace'))
print(r.stderr.decode('utf-8', errors='replace'))
