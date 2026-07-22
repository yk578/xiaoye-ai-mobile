#!/bin/bash
# ═══════════════════════════════════════════════════════
# 小叶AI Termux 一键安装脚本 v2
# ═══════════════════════════════════════════════════════
# 用法：在 Termux 中粘贴运行：
#   curl -sL https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/main/termux-server/setup.sh | bash
#
# 或手动：bash setup.sh
# ═══════════════════════════════════════════════════════

set -e

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║      小叶AI Termux 一键安装脚本 v2       ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════╝${NC}"
echo ""

# 1. 更新包 + 安装 Node.js
echo -e "${BOLD}[1/4] 更新包列表...${NC}"
pkg update -y && pkg upgrade -y

echo -e "${BOLD}[2/4] 安装 Node.js...${NC}"
pkg install -y nodejs

echo -e "${BOLD}[3/4] 创建服务器文件...${NC}"

mkdir -p ~/xiaoye-server

# 先从 GitHub 下载最新版
GITHUB_URL="https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/main/termux-server/server.js"
if curl -sL --connect-timeout 5 "$GITHUB_URL" -o ~/xiaoye-server/server.js && [ -s ~/xiaoye-server/server.js ]; then
  echo -e "  ${GREEN}✓${NC} 已从 GitHub 下载最新服务器"
else
  echo -e "  ${CYAN}⚠ 下载失败，使用内置版本${NC}"
  # 内置版本（与 GitHub 同步）
  cat > ~/xiaoye-server/server.js << 'SERVEREOF'
#!/usr/bin/env node
const http=require('http'),fs=require('fs'),path=require('path'),{execSync:e}=require('child_process'),crypto=require('crypto'),dgram=require('dgram'),os=require('os')
const PORT=2324,UDP_PORT=2325,TOKEN_FILE=path.join((process.env.HOME||'/data/data/com.termux/files/home'),'.xiaoye-token')
let T='';try{if(fs.existsSync(TOKEN_FILE))T=fs.readFileSync(TOKEN_FILE,'utf-8').trim()}catch{};if(!T)T=crypto.randomBytes(16).toString('hex'),fs.writeFileSync(TOKEN_FILE,T)
const ip=()=>{try{const i=os.networkInterfaces();for(const n of Object.keys(i))for(const o of i[n]||[])if(o.family==='IPv4'&&!o.internal)return o.address}catch{}return'127.0.0.1'}
const U=p=>{if(!p)return HOME;if(p.startsWith('~/'))return path.join(HOME,p.slice(2));return p==='~'?HOME:path.resolve(p)},HOME=(process.env.HOME||'/data/data/com.termux/files/home')
const j=(r,s,d)=>{r.writeHead(s,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});r.end(JSON.stringify(d))}
dgram.createSocket('udp4').on('error',()=>{});setInterval(()=>{const m=JSON.stringify({type:'xiaoye-server',version:2,ip:ip(),port:PORT,token:T,seq:Date.now()}),b=Buffer.from(m);const s=dgram.createSocket('udp4');try{s.send(b,0,b.length,UDP_PORT,ip().split('.').slice(0,3).concat(['255']).join('.'),()=>s.close())}catch{try{s.close()}catch{}}},3000)
http.createServer((r,q)=>{q.setHeader('Access-Control-Allow-Origin','*')
if(r.method==='OPTIONS'){q.writeHead(204);q.end();return}
if(r.headers['x-auth-token']!==T)return j(q,401,{error:'Unauthorized'})
const u=new URL(r.url,'http://l:'+PORT)
try{if(u.pathname==='/ping')return j(q,200,{status:'ok'})
if(u.pathname==='/info')return j(q,200,{version:2,ip:ip(),port:PORT,hostname:os.hostname()||'',home:HOME})
if(u.pathname==='/exec'&&r.method==='POST'){let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{const d=JSON.parse(b),o=e(d.command,{cwd:d.cwd?U(d.cwd):HOME,timeout:d.timeout||3e4,encoding:'utf-8',maxBuffer:10485760});j(q,200,{stdout:o||'',stderr:'',exitCode:0})}catch(x){j(q,200,{stdout:x.stdout||'',stderr:x.stderr||'',exitCode:typeof x.code==='number'?x.code:1})}});return}
const P=U(u.searchParams.get('path')||'')
if(u.pathname==='/fs/read'){const p=u.searchParams.get('path');if(!p)return j(q,400,{error:'Invalid path'});if(!fs.existsSync(P))return j(q,404,{error:'Not found'});return j(q,200,{content:fs.readFileSync(P,'utf-8')})}
if(u.pathname==='/fs/write'&&r.method==='POST'){let b='';r.on('data',c=>b+=c);r.on('end',()=>{const d=JSON.parse(b);if(!d.path)return j(q,400,{error:'Invalid path'});fs.mkdirSync(path.dirname(U(d.path)),{recursive:true});fs.writeFileSync(U(d.path),d.content||'','utf-8');j(q,200,{success:true})});return}
if(u.pathname==='/fs/list'){if(!fs.existsSync(P))return j(q,404,{error:'Not found'});const i=fs.readdirSync(P).map(n=>{try{const s=fs.statSync(path.join(P,n));return{name:n,path:path.join(P,n).replace(HOME,'~'),isDirectory:s.isDirectory(),size:s.size,modifiedAt:s.mtime.toISOString()}}catch{return null}}).filter(Boolean);return j(q,200,{files:i})}
if(u.pathname==='/fs/stat'){const p=u.searchParams.get('path');if(!p)return j(q,400,{error:'Invalid path'});if(!fs.existsSync(P))return j(q,404,{error:'Not found'});const s=fs.statSync(P);return j(q,200,{name:path.basename(P),path:p,isDirectory:s.isDirectory(),size:s.size,modifiedAt:s.mtime.toISOString()})}
if(u.pathname==='/fs/delete'&&r.method==='DELETE'){if(fs.existsSync(P))fs.rmSync(P,{recursive:true,force:true});return j(q,200,{success:true})}
if(u.pathname==='/fs/mkdir'&&r.method==='POST'){let b='';r.on('data',c=>b+=c);r.on('end',()=>{fs.mkdirSync(U(JSON.parse(b).path),{recursive:true});j(q,200,{success:true})});return}
j(q,404,{error:'Not found'})}catch(x){j(q,500,{error:x.message})}}).listen(PORT,'0.0.0.0',()=>{const i=ip();console.log('');console.log('╔══════════════════════════════════╗');console.log('║   小叶AI Termux 服务器已启动      ║');console.log('╠══════════════════════════════════╣');console.log('║  地址: http://'+i+':'+PORT);console.log('║  Token: '+T.substring(0,20)+'...');console.log('╠══════════════════════════════════╣');console.log('║  打开App → 自动发现              ║');console.log('╚══════════════════════════════════╝')})
SERVEREOF
  echo -e "  ${GREEN}✓${NC} 内置版本已写入"
fi

# 写启动脚本
cat > ~/xiaoye-server/start.sh << 'STARTEOF'
#!/bin/bash
cd ~/xiaoye-server
node server.js
STARTEOF
chmod +x ~/xiaoye-server/start.sh

# 4. 一键启动
echo ""
echo -e "${BOLD}[4/4] 启动服务器...${NC}"
cd ~/xiaoye-server && node server.js &
sleep 2
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ 安装完成！已启动！           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}以后启动:${NC}"
echo "    cd ~/xiaoye-server && node server.js"
echo "    （或上箭头 + 回车）"
echo ""
echo -e "  ${DIM}查看 Token: cat ~/.xiaoye-token${NC}"
echo -e "  ${DIM}停止: Ctrl+C${NC}"
echo ""
