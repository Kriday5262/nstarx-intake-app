#!/usr/bin/env bash
set -euo pipefail
cd /mnt/hikvision/Shantanu/Work/NStarX-Intake-App
export PATH="$PWD/node_modules/next/dist/bin:$PATH"
export PORT=8090
export HOSTNAME=127.0.0.1
exec node .next/standalone/server.js
