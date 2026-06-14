import sys  
import os  
content = open('D:/lingjing-ide/desktop/electron/scripts/build-main.mjs','r',encoding='utf-8').read()  
content = content.replace("  'uuid',", "  'uuid',\n  'ws',")  
open('D:/lingjing-ide/desktop/electron/scripts/build-main.mjs','w',encoding='utf-8').write(content)  
print('ws added to EXTERNAL')  
