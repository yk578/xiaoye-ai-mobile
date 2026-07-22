#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI 一键启动 v9 - 最终版
# ═══════════════════════════════════════════════════════
# 用 --headless 模式直接后台，不碰 TUI 菜单
# disown 让进程在脚本退出后存活
# ═══════════════════════════════════════════════════════

DIR=~/xiaoye-server
mkdir -p "$DIR"

pkill -f 9router 2>/dev/null
sleep 1

echo "🚀 启动 9router（无头模式）..."
9router --port 7777 --host 127.0.0.1 --headless > "$DIR/9router.log" 2>&1 &
disown
sleep 5

if curl -s --max-time 2 http://127.0.0.1:7777 >/dev/null 2>&1; then
  echo "✅ 9router 运行中"
else
  echo "❌ 9router 启动失败，请手动启动："
  echo "   9router --port 7777 --host 127.0.0.1"
  echo "   然后按 3"
fi

echo "🚀 启动小叶服务器..."
nohup node "$DIR/server.js" > "$DIR/server.log" 2>&1 &
sleep 2

echo ""
echo "✅ 全部完成！"
echo ""
echo "📱 App 操作："
echo "  设置 → AI Provider → 添加"
echo "    地址:  http://127.0.0.1:7777"
echo "    密钥:  空着"
echo "    模型:  oc/deepseek-v4-flash"
echo "  保存 → 开聊"
