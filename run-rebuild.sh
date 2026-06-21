#!/bin/bash
nohup bash /tmp/rebuild.sh > /tmp/rebuild-out.log 2>&1 &
echo "Rebuild PID: $!"
