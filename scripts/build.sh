#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

echo "Building the Next.js project (standalone mode)..."
pnpm next build

echo "Copying static files..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true

# 复制 node_modules 中的原生模块
cp -r node_modules/better-sqlite3 .next/standalone/node_modules/better-sqlite3 2>/dev/null || true

echo "Build completed successfully!"
echo "Note: Database will be stored in /tmp/data in production environment"
