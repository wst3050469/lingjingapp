import subprocess, os

electron_builder = '/home/liuhui/lingjing/desktop/electron/node_modules/.bin/electron-builder'
work_dir = '/home/liuhui/lingjing/desktop/electron'

result = subprocess.run([electron_builder, '--linux', '--x64'], cwd=work_dir, capture_output=True, text=True, timeout=600)
print('STDOUT:', result.stdout[-500:])
print('STDERR:', result.stderr[-500:])
print('RC:', result.returncode)
