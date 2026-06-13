#!/bin/bash
cd /home/liuhui/lingjing-ide
git fetch /tmp/bundle.bundle master:latest-bundle
git reset --hard latest-bundle
echo "BUNDLE_APPLIED"
