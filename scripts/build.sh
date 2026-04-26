#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# Vercel 环境使用官方 npm registry
export npm_config_registry="https://registry.npmjs.org/"

# 清理缓存
rm -rf node_modules .next .vercel
rm -f pnpm-lock.yaml

echo "Installing dependencies..."
pnpm install
# 强制安装 devDependencies（Vercel 默认不安装）
pnpm install --include=dev

echo "Building the Next.js project (standalone mode)..."
pnpm next build

echo "Copying static files..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true

# 复制 node_modules 中的原生模块
cp -r node_modules/better-sqlite3 .next/standalone/node_modules/better-sqlite3 2>/dev/null || true

echo "Build completed successfully!"
echo "Note: Database will be stored in /tmp/data in production environment"
