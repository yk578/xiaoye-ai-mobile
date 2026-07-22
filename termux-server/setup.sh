#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI Termux 一键安装脚本 v3
# ═══════════════════════════════════════════════════════
# 用法（一行完整命令）：
#   curl -sL https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/main/termux-server/setup.sh | bash
# ═══════════════════════════════════════════════════════

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║      小叶AI Termux 一键安装脚本 v3       ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════╝${NC}"
echo ""

# 1. 安装 Node.js（如果还没有）
echo -e "${BOLD}[1/3] 检查 Node.js...${NC}"
if command -v node &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Node.js $(node --version) 已安装"
else
  echo "  正在安装 Node.js..."
  pkg install -y nodejs 2>&1 | tail -3
  if ! command -v node &>/dev/null; then
    echo -e "  ${RED}✗ Node.js 安装失败，请手动执行: pkg install nodejs${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Node.js 安装完成"
fi

# 2. 下载服务器文件
echo -e "${BOLD}[2/3] 下载服务器文件...${NC}"
mkdir -p ~/xiaoye-server

GITHUB_URL="https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/main/termux-server/server.js"
if curl -sL --connect-timeout 10 "$GITHUB_URL" -o ~/xiaoye-server/server.js && [ -s ~/xiaoye-server/server.js ]; then
  echo -e "  ${GREEN}✓${NC} 服务器文件已下载"
  echo -e "  ${DIM}   路径: ~/xiaoye-server/server.js${NC}"
else
  echo -e "  ${RED}✗ 下载失败，请检查网络或手动下载:${NC}"
  echo -e "  ${DIM}   wget -O ~/xiaoye-server/server.js $GITHUB_URL${NC}"
  exit 1
fi

# 写启动脚本
cat > ~/xiaoye-server/start.sh << 'STARTEOF'
#!/bin/bash
cd ~/xiaoye-server
node server.js
STARTEOF
chmod +x ~/xiaoye-server/start.sh

# 3. 启动服务器
echo -e "${BOLD}[3/3] 启动服务器...${NC}"

# 先检查端口是否被占用
if lsof -i :2324 &>/dev/null 2>&1 || ss -tln | grep -q :2324; then
  echo -e "  ${CYAN}⚠ 端口 2324 已被占用（服务器可能已在运行）${NC}"
  echo -e "  ${DIM}   如需重启，先执行: pkill -f 'node server.js'${NC}"
else
  cd ~/xiaoye-server && nohup node server.js > ~/xiaoye-server/server.log 2>&1 &
  sleep 2
  # 验证启动成功
  if curl -s http://127.0.0.1:2324/ping -H "X-Auth-Token: $(cat ~/.xiaoye-token 2>/dev/null)" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} 服务器已启动"
  else
    echo -e "  ${RED}✗ 启动失败，查看日志: cat ~/xiaoye-server/server.log${NC}"
    exit 1
  fi
fi

# 显示连接信息
TOKEN=$(cat ~/.xiaoye-token 2>/dev/null)
IP=$(curl -s http://127.0.0.1:2324/info -H "X-Auth-Token: $TOKEN" 2>/dev/null | grep -o '"ip":"[^"]*"' | cut -d'"' -f4)
IP=${IP:-127.0.0.1}

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ 安装完成！已启动！           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}连接信息${NC}"
echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  IP:     ${CYAN}$IP${NC}"
echo -e "  Token:  ${CYAN}${TOKEN:0:20}...${NC}"
echo -e "  端口:   2324"
echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  打开 ${BOLD}小叶AI App${NC} → 设置 → 自动发现"
echo ""

# 提示持久化
echo -e "  ${DIM}📌 后台运行（关闭 Termux 后保持）:${NC}"
echo -e "  ${DIM}   termux-wake-lock && cd ~/xiaoye-server && node server.js${NC}"
echo -e "  ${DIM}📌 查看 Token: cat ~/.xiaoye-token${NC}"
echo -e "  ${DIM}📌 查看日志: cat ~/xiaoye-server/server.log${NC}"
echo -e "  ${DIM}📌 停止: pkill -f 'node server.js'${NC}"
echo ""
