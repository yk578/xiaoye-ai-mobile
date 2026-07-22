#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI Termux 一键安装脚本 v4 — 含 9router 免费模型
# ═══════════════════════════════════════════════════════
# 用法（一行完整命令）：
#   curl -sL https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/master/termux-server/setup.sh | bash
# ═══════════════════════════════════════════════════════

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║       小叶AI Termux 一键安装 v4             ║${NC}"
echo -e "${PURPLE}║       含 9router 免费 AI 模型               ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════╝${NC}"
echo ""

SERVER_DIR="$HOME/xiaoye-server"

# 1. 安装 Node.js
echo -e "${BOLD}[1/4] 检查 Node.js...${NC}"
if command -v node &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"
else
  echo "  正在安装 Node.js..."
  pkg install -y nodejs 2>&1 | tail -3
  if ! command -v node &>/dev/null; then
    echo -e "  ${RED}✗ 安装失败，手动: pkg install nodejs${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Node.js 安装完成"
fi

# 2. 安装 9router
echo -e "${BOLD}[2/4] 安装 9router（免费 AI 模型引擎）...${NC}"
if command -v 9router &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} 9router 已安装，版本: $(9router --version 2>/dev/null || echo 'ok')"
else
  npm install -g 9router 2>&1 | tail -3
  if command -v 9router &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} 9router 安装完成"
  else
    echo -e "  ${RED}✗ 安装失败，手动: npm install -g 9router${NC}"
    exit 1
  fi
fi

# 3. 下载小叶服务器
echo -e "${BOLD}[3/4] 下载小叶服务器...${NC}"
mkdir -p "$SERVER_DIR"

GITHUB_URL="https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/master/termux-server/server.js"
if curl -sL --connect-timeout 10 "$GITHUB_URL" -o "$SERVER_DIR/server.js" && [ -s "$SERVER_DIR/server.js" ]; then
  echo -e "  ${GREEN}✓${NC} 服务器文件已下载"
else
  echo -e "  ${RED}✗ 下载失败，手动: wget -O $SERVER_DIR/server.js $GITHUB_URL${NC}"
  exit 1
fi

# 写启动脚本（同时启动两个服务）
cat > "$SERVER_DIR/start.sh" << 'STARTEOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "--- 启动 9router（免费 AI 模型）---"
nohup 9router --port 7777 > "$DIR/9router.log" 2>&1 &
echo "  9router PID: $!"
echo "--- 启动小叶服务器 ---"
exec node "$DIR/server.js"
STARTEOF
chmod +x "$SERVER_DIR/start.sh"

# 写一键启动助手
cat > "$SERVER_DIR/status.sh" << 'STATUSEOF'
#!/bin/bash
echo "=== 小叶AI 服务状态 ==="
echo ""
# 检查 9router
if curl -s http://127.0.0.1:7777 >/dev/null 2>&1; then
  echo "  ✅ 9router (端口 7777) — 运行中"
else
  echo "  ❌ 9router (端口 7777) — 未运行"
fi
# 检查小叶服务器
TOKEN=$(cat ~/.xiaoye-token 2>/dev/null)
if curl -s http://127.0.0.1:2324/ping -H "X-Auth-Token: $TOKEN" >/dev/null 2>&1; then
  echo "  ✅ 小叶服务器 (端口 2324) — 运行中"
  echo "  Token: ${TOKEN:0:20}..."
else
  echo "  ❌ 小叶服务器 (端口 2324) — 未运行"
fi
echo ""
echo "全部启动: cd ~/xiaoye-server && bash start.sh"
STATUSEOF
chmod +x "$SERVER_DIR/status.sh"

# 4. 启动服务
echo -e "${BOLD}[4/4] 启动服务...${NC}"

# 启动 9router
if ss -tln | grep -q :7777; then
  echo -e "  ${CYAN}⚠ 9router 已在运行 (端口 7777)${NC}"
else
  nohup 9router --port 7777 > "$SERVER_DIR/9router.log" 2>&1 &
  sleep 3
  if curl -s http://127.0.0.1:7777 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} 9router 已启动 (端口 7777)"
  else
    echo -e "  ${RED}✗ 9router 启动失败，日志: cat $SERVER_DIR/9router.log${NC}"
  fi
fi

# 启动小叶服务器
if ss -tln | grep -q :2324; then
  echo -e "  ${CYAN}⚠ 小叶服务器已在运行 (端口 2324)${NC}"
else
  nohup node "$SERVER_DIR/server.js" > "$SERVER_DIR/server.log" 2>&1 &
  sleep 2
  TOKEN=$(cat ~/.xiaoye-token 2>/dev/null)
  if curl -s http://127.0.0.1:2324/ping -H "X-Auth-Token: $TOKEN" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} 小叶服务器已启动 (端口 2324)"
  else
    echo -e "  ${RED}✗ 小叶服务器启动失败，日志: cat $SERVER_DIR/server.log${NC}"
  fi
fi

IP=$(curl -s http://127.0.0.1:2324/info -H "X-Auth-Token: $(cat ~/.xiaoye-token 2>/dev/null)" 2>/dev/null | grep -o '"ip":"[^"]*"' | cut -d'"' -f4)
IP=${IP:-127.0.0.1}

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ 全部安装完成！                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}服务已启动：${NC}"
echo -e "  ┌─────────────────────┬────────┬──────────────────────┐"
echo -e "  │ 9router (免费模型)  │ $IP:7777 │ App Provider 地址    │"
echo -e "  │ 小叶服务器(文件/执行)│ $IP:2324 │ App 自动发现连接     │"
echo -e "  └─────────────────────┴────────┴──────────────────────┘"
echo ""
echo -e "  ${BOLD}📱 App 设置 → AI Provider → + 添加:${NC}"
echo -e "  ${CYAN}  名称:        手机 9router${NC}"
echo -e "  ${CYAN}  接口地址:    http://127.0.0.1:7777${NC}"
echo -e "  ${CYAN}  API 密钥:    free${NC}"
echo -e "  ${CYAN}  默认模型:    oc/deepseek-v4-flash${NC}"
echo ""
echo -e "  ${DIM}📌 以后启动: cd ~/xiaoye-server && bash start.sh${NC}"
echo -e "  ${DIM}📌 查看状态: bash ~/xiaoye-server/status.sh${NC}"
echo -e "  ${DIM}📌 停止全部: pkill -f 'node server.js' && pkill -f '9router'${NC}"
echo -e "  ${DIM}📌 9router 日志: cat ~/xiaoye-server/9router.log${NC}"
echo ""
