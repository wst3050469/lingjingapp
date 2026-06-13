#!/bin/bash
cd /home/liuhui/lingjing-ide
git stash 2>/dev/null
git pull /tmp/full-bundle.bundle HEAD
echo "Git updated OK ($(git rev-parse --short HEAD))"
