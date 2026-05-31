import subprocess
BUILD = 'liuhui@192.168.1.9'

# Start Windows build in tmux session
cmd = '''
tmux new-session -d -s win_build '
cd /home/liuhui/lingjing/packages/electron
echo "=== Windows Build v1.64.13 Start: $(date) ==="
node scripts/pre-package.mjs
export WINEDLLOVERRIDES="winemenubuilder.exe=d"
npx electron-builder build --win --x64 --config electron-builder.json 2>&1 | tail -20
echo "=== Windows Build End: $(date) ==="
ls -lh release-v1500/LingJing-Setup-1.64.13-win-x64.exe release-v1500/LingJing-Portable-1.64.13-win-x64.exe 2>/dev/null
'
echo "Build started in tmux session 'win_build'"
'''

r = subprocess.run(['ssh', BUILD, cmd], capture_output=True, text=True, timeout=30)
print(r.stdout[:200] if r.stdout else r.stderr[:200])
print("Windows build launched in background")
