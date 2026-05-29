#!/bin/bash
nohup bash /tmp/run_dpkg.sh > /tmp/dpkg_build.log 2>&1 &
echo "PID: $!"
