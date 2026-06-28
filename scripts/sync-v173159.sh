#!/bin/bash
set -e
T=/tmp/v173159
W=/home/liuhui/lingjing
cp $T/system-control-ipc.ts $W/packages/electron/src/ipc/system-control-ipc.ts
cp $T/main.ts $W/packages/electron/src/main.ts
cp $T/preload.ts $W/packages/electron/src/preload.ts
cp $T/package.json $W/packages/electron/package.json
cp $T/build-main.mjs $W/packages/electron/scripts/build-main.mjs
cp $T/electron.d.ts $W/packages/renderer/src/types/electron.d.ts
echo FILES_COPIED
