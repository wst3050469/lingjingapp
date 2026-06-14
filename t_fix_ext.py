# fix external array  
import sys  
lines = open('D:/lingjing-ide/desktop/electron/scripts/build-main.mjs','r',encoding='utf-8').read().split(chr(10))  
  
# Find EXTERNAL start and end  
start = -1  
end = -1  
for i,l in enumerate(lines):  
  if l.strip() == 'const EXTERNAL = [':  
    start = i  
  if l.strip() == '];' and start != -1 and end == -1:  
    end = i  
  
print('start:',start,'end:',end)  
# replace external array  
start = 89  
end = 124  
new_block = [  
  'const EXTERNAL = [',  
  '  // Native/binary modules - cannot be bundled',  
  '  \"electron\",',  
  '  \"sql.js\",',  
  '  \"ssh2\",',  
  '  \"cpu-features\",',  
  '  \"node-pty\",',  
  '  \"fsevents\",',  
  '  // Huge packages - keep external',  
  '  \"playwright\",',  
  '  \"playwright-core\",',  
  '  // @codepilot/core root bundled, subpaths external',  
  '  \"@codepilot/core/mcp\",',  
  '  \"@codepilot/core/fusion\",',  
  '  \"@codepilot/core/voice\",',  
  '  \"@codepilot/core/checkpoint\",',  
  '  \"@codepilot/core/context\",',  
  '  \"@codepilot/core/rules\",',  
  '  \"@codepilot/core/utils\",',  
  '  \"@codepilot/core/intent\",',  
  '  \"@codepilot/core/terminal-suggester\",',  
  '  \"@codepilot/core/auto-fix\",',  
  '  \"@codepilot/core/agent-mode\",',  
  '  \"@codepilot/core/multi-file-edit\",',  
  '  \"@codepilot/core/pipeline\",',  
  '  \"@codepilot/core/security\",',  
  '  \"@codepilot/core/pm\",',  
  '  \"@codepilot/core/review\",',  
  '  // Pure JS',  
  '  \"bcryptjs\",',  
  '  \"chokidar\",',  
  '  \"exceljs\",',  
  '  \"express\",',  
  '  \"ws\",',  
  '  \"electron-updater\",',  
  '  \"fast-glob\",',  
  '  \"jose\",',  
  '  \"uuid\",',  
  '  \"zod\",',  
  '  \"gpt-tokenizer\",',  
  '  \"yaml\",',  
  '  \"cron-parser\",',  
  '  // pnpm store resolution issues',  
  '  \"underscore\",',  
  '  \"readable-stream\",',  
']'  
lines[start:end+1] = new_block  
result = chr(10).join(lines)  
open('D:/lingjing-ide/desktop/electron/scripts/build-main.mjs','w',encoding='utf-8').write(result)  
print('EXTERNAL array replaced')  
