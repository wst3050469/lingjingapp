import os, shutil

src_dir = '/var/www/downloads/v1.73.130'
dst_dir = '/var/www/downloads/v1.73.131'

os.makedirs(dst_dir, exist_ok=True)

for f in os.listdir(src_dir):
    src = os.path.join(src_dir, f)
    dst = os.path.join(dst_dir, f.replace('1.73.130', '1.73.131'))
    print(f'Copy: {f} -> {os.path.basename(dst)}')
    shutil.copy2(src, dst)

print('Done!')
