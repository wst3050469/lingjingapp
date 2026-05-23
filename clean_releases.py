import os, glob, shutil, time

base = r'D:\lingjing\lingjing\packages\electron'
keep = {'release-v1527'}

for d in sorted(glob.glob(os.path.join(base, 'release-v*'))):
    name = os.path.basename(d)
    if name in keep or not os.path.isdir(d):
        continue
    
    sz = sum(os.path.getsize(os.path.join(dp, f)) 
             for dp, _, fn in os.walk(d) for f in fn) / (1024*1024)
    
    # Retry deletion with delay for locked files
    for attempt in range(3):
        try:
            shutil.rmtree(d, ignore_errors=False)
            print(f'Removed: {name} ({sz:.0f}MB)')
            break
        except PermissionError:
            if attempt < 2:
                print(f'  Locked: {name}, retrying in 2s...')
                time.sleep(2)
            else:
                # Force delete individual files
                try:
                    for dp, _, fn in os.walk(d, topdown=False):
                        for f in fn:
                            fp = os.path.join(dp, f)
                            try:
                                os.chmod(fp, 0o777)
                                os.remove(fp)
                            except:
                                pass
                        try:
                            os.rmdir(dp)
                        except:
                            pass
                    print(f'Removed (forced): {name} ({sz:.0f}MB)')
                except:
                    print(f'Skipped (locked): {name}')
print('Done')
