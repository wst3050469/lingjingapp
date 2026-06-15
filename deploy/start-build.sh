#!/bin/bash
nohup bash /tmp/run-linux-build.sh > /tmp/build-linux-v17387.log 2>&1 &
echo "Build PID: $!"
