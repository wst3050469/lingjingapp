#!/bin/bash
rm -f /home/liuhui/lingjing/packages/electron/release/LingJing-1.63.0-linux-x86_64.deb
dpkg-deb --build /home/liuhui/lingjing/packages/electron/release/linux-unpacked /home/liuhui/lingjing/packages/electron/release/LingJing-1.63.0-linux-x86_64.deb
echo "dpkg-deb EXIT: $?" >> /tmp/dpkg_final.log
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-1.63.0-linux-x86_64.deb >> /tmp/dpkg_final.log
date >> /tmp/dpkg_final.log
