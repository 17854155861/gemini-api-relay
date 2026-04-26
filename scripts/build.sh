#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# 强制使用官方 npm registry
export npm_config_registry="https://registry.npmjs.org/"
echo "registry=https://registry.npmjs.org/" > .npmrc

# 清理所有缓存
rm -rf node_modules .next .vercel
rm -f pnpm-lock.yaml

echo "Installing dependencies..."
pnpm install --ignore-scripts
pnpm install --include=dev --ignore-scripts
# 单独运行必要的后安装脚本（避免 inotify 等问题包）
pnpm exec playwright install-deps 2>/dev/null || true

echo "Building the Next.js project..."
pnpm next build

echo "Building the Next.js project (standalone mode)..."
pnpm next build

echo "Copying static files..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true

# 复制 node_modules 中的原生模块
cp -r node_modules/better-sqlite3 .next/standalone/node_modules/better-sqlite3 2>/dev/null || true

echo "Build completed successfully!"
echo "Note: Database will be stored in /tmp/data in production environment"
