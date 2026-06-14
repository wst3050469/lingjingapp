import subprocess

def ssh_cmd(cmd):
    r = subprocess.run(["ssh", "root@120.55.5.220", cmd],
                       capture_output=True, timeout=15)
    out = r.stdout.decode('utf-8', errors='replace')
    err = r.stderr.decode('utf-8', errors='replace')
    return out, err

# Check build env
out, _ = ssh_cmd("ls /root/lingjing-build/desktop/electron/package.json 2>/dev/null && echo EXISTS || echo NOT_FOUND")
print("Build env:", out.strip())

# Check admin-api
out, _ = ssh_cmd("grep -c normalizePlatformNames /root/cloud-server/admin-api.js 2>/dev/null || echo 0")
print("normalizePlatformNames count:", out.strip())

# Check versions on server
out, _ = ssh_cmd("curl -s http://localhost:8000/api/versions | python3 -c \"import sys,json; d=json.load(sys.stdin); print('total:', d.get('pagination',{}).get('total','?'))\" 2>/dev/null || echo 'N/A'")
print("DB versions:", out.strip())
