#!/bin/bash
# dev.sh — Start H5 dev server and launch Electron via launcher

# Ensure ELECTRON_RUN_AS_NODE is unset at bash level
unset ELECTRON_RUN_AS_NODE

# Start H5 dev server in background
npx uni --platform h5 &
H5_PID=$!

# Wait for Vite to start (up to 15s)
PORT=""
for i in $(seq 1 15); do
  sleep 1
  for p in 5173 5174 5175 5176 5177 5178 5179 5180; do
    if curl -s -o /dev/null "http://localhost:$p" 2>/dev/null; then
      PORT=$p
      break 2
    fi
  done
done

if [ -z "$PORT" ]; then
  echo "[dev.sh] 无法检测 Vite 端口，默认使用 5173"
  PORT=5173
fi

echo "[dev.sh] Vite 运行在端口 $PORT，启动 Electron..."
VITE_DEV_PORT=$PORT node "$(dirname "$0")/launcher.cjs"

kill $H5_PID 2>/dev/null
