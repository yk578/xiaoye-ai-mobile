#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI 一键启动 v7
# ═══════════════════════════════════════════════════════
# 用 tmux 后台跑 9router，等菜单出来自动按 3
# ═══════════════════════════════════════════════════════

DIR=~/xiaoye-server
mkdir -p "$DIR"

# 装 tmux
command -v tmux &>/dev/null || pkg install tmux -y

# 杀老的
pkill -f 9router 2>/dev/null
sleep 1

# 启动 9router 到 tmux 会话（菜单界面）
echo "⏳ 启动 9router..."
tmux new-session -d -s 9router '9router --port 7777 --host 127.0.0.1'

# 等菜单加载完成（固定等 5 秒足够）
sleep 5

# 自动按 3 选 Hide to Tray
tmux send-keys -t 9router '3'
sleep 2

# 验证
if curl -s --max-time 2 http://127.0.0.1:7777 >/dev/null 2>&1; then
  echo "✅ 9router 运行中 (端口 7777)"
else
  echo ""
  echo "⚠️ 第一次自动隐藏没成功，再试一次..."
  tmux send-keys -t 9router '3'
  sleep 3
  if curl -s --max-time 2 http://127.0.0.1:7777 >/dev/null 2>&1; then
    echo "✅ 9router 运行中 (端口 7777)"
  else
    echo ""
    echo "📌 请手动操作："
    echo "   tmux attach -t 9router"
    echo "   然后在菜单里按数字 3（Hide to Tray）"
  fi
fi

# 启动小叶服务器
if curl -s --max-time 2 http://127.0.0.1:2324/ping >/dev/null 2>&1; then
  echo "✅ 小叶服务器已在运行"
else
  nohup node "$DIR/server.js" > "$DIR/server.log" 2>&1 &
  sleep 2
fi

echo ""
echo "══════════════════════════════════"
echo "  ✅ 全部完成！"
echo ""
echo "  App 操作："
echo "  设置 → AI Provider → 添加"
echo "    地址:  http://127.0.0.1:7777"
echo "    密钥:  空着"
echo "    模型:  oc/deepseek-v4-flash"
echo "  保存 → 开聊"
echo "══════════════════════════════════"
