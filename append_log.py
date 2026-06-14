# -*- coding: utf-8 -*-
with open('D:/lingjing-ide/日志.md', 'a', encoding='utf-8') as f:
    f.write('\n\n### 补充部署 (2026-06-14 22:42)\n')
    f.write('- **Linux deb**: LingJing-1.73.73-linux-x86_64.deb (189MB) \u2705 已上传至生产服务器\n')
    f.write('- **versions.json**: 已添加 deb 入口，全平台（win/linux AppImage/linux deb）完整\n')
    f.write('- **deb 构建方法**: `ar rcs` + `tar czf` 手动构建（dpkg-deb 对中文路径支持不佳，fpm 卡死）\n')
print('OK')
