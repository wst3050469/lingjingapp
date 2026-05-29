#!/bin/bash
cd /home/liuhui/lingjing/packages/electron
# 修改 electron-builder.json 临时启用 gzip 压缩
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('electron-builder.json', 'utf8'));
cfg.deb = cfg.deb || {};
cfg.deb.compression = 'gzip';
fs.writeFileSync('electron-builder.json.gzip', JSON.stringify(cfg, null, 2));
"
npx electron-builder build --linux deb --x64 --config electron-builder.json.gzip
