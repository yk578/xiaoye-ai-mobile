#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI 一键启动脚本
# 启动 9router（免费 AI 模型）+ 小叶服务器
# ═══════════════════════════════════════════════════════

DIR=~/xiaoye-server

echo "🚀 启动 9router..."
proot -0 9router --port 7777 > /dev/null 2>&1 &
sleep 5

echo "🚀 启动小叶服务器..."
nohup node "$DIR/server.js" > /dev/null 2>&1 &
sleep 2

echo ""
echo "✅ 全部已启动！"
echo ""
echo "   9router:    http://127.0.0.1:7777"
echo "   小叶服务器:  http://127.0.0.1:2324"
echo ""
echo "📱 App 设置 → 自动发现 → 开聊"
