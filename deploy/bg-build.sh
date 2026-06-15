#!/bin/bash
exec > /tmp/build-linux-v17387.log 2>&1
cd /home/liuhui/lingjing-ide/desktop/electron
echo "=== Build Start: $(date) ==="
pnpm dist:linux
echo "=== Build End: $(date) exit=$? ==="
