#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

cd "${COZE_WORKSPACE_PATH}/.next/standalone"

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
PORT=${DEPLOY_RUN_PORT} node server.js &

# 等待服务启动
sleep 3

# 初始化数据库（生产环境会从对象存储下载）
echo "Initializing database..."
curl -s "http://localhost:${DEPLOY_RUN_PORT}/api/init-db" || echo "Database init call completed"

# 保持服务运行
wait
