import os  
import shutil  
import subprocess  
BUILD_DIR = "/tmp/deb-build"  
os.makedirs(f"{BUILD_DIR}/DEBIAN", exist_ok=True)  
os.makedirs(f"{BUILD_DIR}/opt/Áé¾³", exist_ok=True)  
UNPACKED = "/home/liuhui/lingjing/packages/electron/release/linux-unpacked"  
ASSETS = "/home/liuhui/lingjing/packages/electron/assets"  
RELEASE = "/home/liuhui/lingjing/packages/electron/release"  
"# Copy linux-unpacked contents"  
"for item in os.listdir(UNPACKED):"  
'    s = os.path.join(UNPACKED, item)'  
'    d = os.path.join(f"{BUILD_DIR}/opt/Áé¾³", item)'  
"    if os.path.isdir(s):"  
"        shutil.copytree(s, d, symlinks=True)"  
"    else:"  
"        shutil.copy2(s, d)"  
"print('Files copied')" 
