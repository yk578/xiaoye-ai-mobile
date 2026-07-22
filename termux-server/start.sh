#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI 一键启动 v5 - 全自动
# ═══════════════════════════════════════════════════════

DIR=~/xiaoye-server
mkdir -p "$DIR"

# ── 1. 装 tmux（用于后台跑 9router）──
if ! command -v tmux &>/dev/null; then
  echo "📦 安装 tmux..."
  pkg install tmux -y >/dev/null 2>&1
fi

# ── 2. 启动 9router ──
if curl -s --max-time 2 http://127.0.0.1:7777 >/dev/null 2>&1; then
  echo "✅ 9router 已在运行"
else
  echo "🚀 启动 9router..."
  # tmux 后台跑 9router，然后自动按"3"选 Hide to Tray
  tmux new-session -d -s 9router '9router --port 7777 --host 127.0.0.1'
  sleep 3
  tmux send-keys -t 9router '3' Enter
  sleep 3
fi

# ── 3. 启动小叶服务器 ──
if curl -s --max-time 2 http://127.0.0.1:2324/ping >/dev/null 2>&1; then
  echo "✅ 小叶服务器已在运行"
else
  echo "🚀 启动小叶服务器..."
  nohup node "$DIR/server.js" > "$DIR/server.log" 2>&1 &
  sleep 2
fi

echo ""
echo "✅ 全部完成！"
echo ""
echo "📱 App 开聊："
echo "   设置 → AI Provider → 添加"
echo "     地址:  http://127.0.0.1:7777"
echo "     密钥:  空着"
echo "     模型:  oc/deepseek-v4-flash"
echo "   保存后直接聊天"
