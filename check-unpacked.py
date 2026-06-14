import os, glob, shutil

# Check what we have in win-unpacked
base = r'D:\lingjing-ide\desktop\electron\release-v17363\win-unpacked'
files = []
for root, dirs, fnames in os.walk(base):
    for fn in fnames:
        fp = os.path.join(root, fn)
        sz = os.path.getsize(fp)
        files.append((sz, fp))

files.sort(reverse=True)
print(f'Top 10 largest files in win-unpacked:')
for sz, fp in files[:10]:
    print(f'  {sz/1024/1024:7.1f} MB  {fp[len(base)+1:]}')

# Check app.asar
asar_path = os.path.join(base, 'resources', 'app.asar')
if os.path.exists(asar_path):
    print(f'\napp.asar: {os.path.getsize(asar_path)/1024/1024:.0f} MB')
else:
    print('\napp.asar NOT FOUND')
    # Check resources dir
    res = os.path.join(base, 'resources')
    if os.path.exists(res):
        print(f'resources contents:')
        for f in sorted(os.listdir(res)):
            fp = os.path.join(res, f)
            sz = os.path.getsize(fp) / 1024**2 if os.path.isfile(fp) else 0
            print(f'  {f} ({sz:.0f} MB)')
    
# Check the exe
exe_path = os.path.join(base, '灵境.exe')
if os.path.exists(exe_path):
    print(f'\n灵境.exe: {os.path.getsize(exe_path)/1024/1024:.0f} MB')
