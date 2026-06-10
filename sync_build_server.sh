#!/bin/bash
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 liuhui@192.168.1.9 << 'REMOTESCRIPT'
cd /root/lingjing-git
git fetch origin main
git merge origin/main --ff-only
echo "Build server sync complete"
REMOTESCRIPT
