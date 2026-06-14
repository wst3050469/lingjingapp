#!/bin/bash
# Run the full build and capture everything to log
python3 /tmp/build-v3.py >> /tmp/build-v3.log 2>&1
echo "BUILD_EXIT_CODE=$?" >> /tmp/build-v3.log

# If build succeeded, copy outputs to downloads
if [ -f /root/lingjing-v17369/desktop/electron/release-v17369/*.AppImage ]; then
    cp /root/lingjing-v17369/desktop/electron/release-v17369/*.AppImage /var/www/downloads/
    cp /root/lingjing-v17369/desktop/electron/release-v17369/*.deb /var/www/downloads/
    cp /root/lingjing-v17369/desktop/electron/release-v17369/latest-linux.yml /var/www/downloads/
    echo "FILES_COPIED_TO_DOWNLOADS" >> /tmp/build-v3.log
fi
