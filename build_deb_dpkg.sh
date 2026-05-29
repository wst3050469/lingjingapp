#!/bin/bash
set -e
echo "Creating DEB package manually..."
rm -rf /tmp/deb-pkg
mkdir -p /tmp/deb-pkg/DEBIAN
mkdir -p /tmp/deb-pkg/opt/灵境
cp -a /home/liuhui/lingjing/packages/electron/release/linux-unpacked/. /tmp/deb-pkg/opt/灵境/
cat > /tmp/deb-pkg/DEBIAN/control << 'ENDCONTROL'
Package: lingjing-ide
Version: 1.63.0
Section: devel
Priority: optional
Architecture: amd64
Maintainer: LingJing AI <support@lingjing.ai>
Description: 灵境 IDE - AI 驱动的智能开发平台
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
ENDCONTROL
echo "Building .deb..."
dpkg-deb --build /tmp/deb-pkg /home/liuhui/lingjing/packages/electron/release/LingJing-1.63.0-linux-x86_64.deb
echo "Done!"
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-1.63.0-linux-x86_64.deb
