import subprocess, sys
print("A", flush=True)
r = subprocess.run(['ssh', 'liuhui@192.168.1.9', 'sleep 30; echo done'], capture_output=True, timeout=60)
print("B", r.returncode, r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
print("C", flush=True)
