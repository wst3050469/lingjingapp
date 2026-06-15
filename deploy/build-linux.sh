#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide/desktop/electron
echo "=== Linux Build Start: $(date) ==="
pnpm dist:linux
echo "=== Linux Build Complete: $(date) ==="
echo "BUILD_EXIT_CODE=$?"
