#!/bin/bash
rm -rf /tmp/repo-extract
mkdir -p /tmp/repo-extract
cd /tmp/repo-extract
tar xzf /tmp/repo.tar.gz
git push /root/lingjing-ide-git master
