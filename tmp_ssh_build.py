import subprocess, sys

# Run build-main on build machine via SSH
ssh_cmd = [
    'ssh', 'liuhui@192.168.1.9',
    'cd /home/liuhui/lingjing-ide/desktop/electron && node scripts/build-main.mjs'
]

result = subprocess.run(ssh_cmd, capture_output=True, text=True)
print('STDOUT:', result.stdout[-1000:])
print('STDERR:', result.stderr[-1000:])
print('Return:', result.returncode)
