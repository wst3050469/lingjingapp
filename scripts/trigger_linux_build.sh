#!/bin/bash
ssh liuhui@192.168.1.9 'tmux new-session -d -s linux_build_v1647 "cd /home/liuhui/lingjing && git pull 2>&1 && cd packages/electron && node scripts/build-main.mjs 2>&1 && cd /home/liuhui/lingjing && bash build-linux.sh 2>&1 | tee /tmp/linux_build_v1647.log"'
echo "Linux build triggered in tmux session: linux_build_v1647"
