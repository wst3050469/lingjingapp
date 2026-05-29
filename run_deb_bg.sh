#!/bin/bash
nohup bash /tmp/build_deb_dpkg.sh > /tmp/deb_build.log 2>&1 &
echo "DEB build started in background, PID: $!"
