#!/bin/bash
cp /tmp/lingjing-docker/docker-compose.yml /root/lingjing/
mkdir -p /root/lingjing/docker
cp /tmp/lingjing-docker/Dockerfile.win /root/lingjing/docker/
cp /tmp/lingjing-docker/docker-build.sh /root/lingjing/scripts/
chmod +x /root/lingjing/scripts/docker-build.sh
echo "Docker files deployed to /root/lingjing/"
