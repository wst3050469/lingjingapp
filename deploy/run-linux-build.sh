#!/bin/bash
cd /home/liuhui/lingjing-ide/desktop/electron
echo "=== Linux Build Start: $(date) ==="
pnpm dist:linux 2>&1
echo "=== Linux Build End: $(date) ==="
echo "EXIT_CODE=$?"
