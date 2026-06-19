#!/bin/bash
echo "=== Full Build Log ==="
cat /tmp/build_win_116.log
echo ""
echo "=== Release v1500 all files ==="
ls -lhS /home/liuhui/lingjingapp/packages/electron/release-v1500/
echo ""
echo "=== NSIS 7z ==="
ls -lh /home/liuhui/lingjingapp/packages/electron/release-v1500/lingjing-ide-*.nsis.7z 2>/dev/null || echo "(no nsis.7z)"
echo ""
echo "=== Check if 7za replaced ==="
/home/liuhui/lingjingapp/node_modules/.pnpm/7zip-bin@5.2.0/node_modules/7zip-bin/linux/x64/7za 2>&1 | head -2
