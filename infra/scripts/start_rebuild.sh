#!/bin/bash
nohup bash /tmp/rebuild_linux.sh > /tmp/rebuild-linux.log 2>&1 &
echo "Build PID: $!"
