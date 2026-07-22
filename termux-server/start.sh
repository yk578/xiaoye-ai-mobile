#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI 一键启动 v6 - 绝对可靠
# ═══════════════════════════════════════════════════════
# 用 tmux 后台运行 9router，等菜单出现后自动按 3
# ═══════════════════════════════════════════════════════

DIR=~/xiaoye-server
mkdir -p "$DIR"

# 装 tmux
command -v tmux &>/dev/null || pkg install tmux -y

# 杀老的
pkill -f 9router 2>/dev/null
sleep 1

# 启动 9router 到 tmux 会话
tmux new-session -d -s 9router '9router --port 7777 --host 127.0.0.1'

# 等 9router 菜单出现（检测端口 7777 开始监听）
echo -n "⏳ 等待 9router..."
for i in $(seq 1 15); do
  sleep 1
  echo -n "."
  # 如果能连上 7777 说明菜单已显示，按 3
  if curl -s --max-time 1 http://127.0.0.1:7777 >/dev/null 2>&1; then
    echo ""
    echo "✅ 9router 菜单已加载，自动隐藏到托盘..."
    tmux send-keys -t 9router '3'
    sleep 3
    break
  fi
done

# 再验证一次
if curl -s --max-time 2 http://127.0.0.1:7777 >/dev/null 2>&1; then
  echo "✅ 9router 运行中 (端口 7777)"
else
  echo ""
  echo "⚠️ 9router 菜单没自动隐藏，手动操作："
  echo "   tmux attach -t 9router"
  echo "   然后按数字 3 选择 Hide to Tray"
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
