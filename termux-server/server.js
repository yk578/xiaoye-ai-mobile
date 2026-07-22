#!/usr/bin/env node
/**
 * 小叶AI Termux 服务端 v2
 *
 * 提供文件系统操作、命令执行和 UDP 自动发现。
 *
 * 启动: node server.js
 * 一键安装: curl -sL https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/master/termux-server/setup.sh | bash
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const crypto = require('crypto')
const dgram = require('dgram')
const os = require('os')

/* ── 配置 ── */
const PORT = 2324
const UDP_PORT = 2325
const HOME = process.env.HOME || '/data/data/com.termux/files/home'
const TOKEN_FILE = path.join(HOME, '.xiaoye-token')

/* ── Token 管理 ── */
let AUTH_TOKEN = ''

function loadOrCreateToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      AUTH_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
      if (AUTH_TOKEN) return
    }
  } catch {}
  AUTH_TOKEN = crypto.randomBytes(16).toString('hex')
  fs.writeFileSync(TOKEN_FILE, AUTH_TOKEN)
}

loadOrCreateToken()

/* ── 获取本机 IP ── */
function getLocalIP() {
  try {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) return iface.address
      }
    }
  } catch {}
  // fallback: 尝试解析 hostname
  try {
    const out = execSync('hostname -I 2>/dev/null || ip addr show 2>/dev/null | grep -oP "(?<=inet )\\d+\\.\\d+\\.\\d+\\.\\d+" | grep -v 127.0.0.1 | head -1', { encoding: 'utf-8', timeout: 5000 })
    return out.trim().split(/\s+/)[0]
  } catch {}
  return '127.0.0.1'
}

/* ── UDP 广播 — 自动发现 ── */
function startUDPBroadcast() {
  const sock = dgram.createSocket('udp4')
  const ip = getLocalIP()
  let seq = 0

  sock.on('error', () => {})

  setInterval(() => {
    seq++
    const msg = Buffer.from(JSON.stringify({
      type: 'xiaoye-server',
      version: 2,
      ip,
      port: PORT,
      token: AUTH_TOKEN,
      hostname: os.hostname() || '',
      seq,
    }))

    // 广播到子网广播地址
    const parts = ip.split('.')
    const broadcast = parts.slice(0, 3).concat(['255']).join('.')
    sock.send(msg, 0, msg.length, UDP_PORT, broadcast, () => {})

    // 也发到全局广播
    sock.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255', () => {})
  }, 3000)

  console.log(`  📡 UDP 自动发现: 端口 ${UDP_PORT} (每3秒广播)`)
}

/* ── HTTP 服务器 ── */

// 路径处理
function expandHome(p) {
  if (!p) return HOME
  if (p.startsWith('~/')) return path.join(HOME, p.slice(2))
  if (p === '~') return HOME
  return path.resolve(p)
}

function isSafePath(p) {
  const resolved = path.resolve(expandHome(p))
  return resolved.startsWith(HOME) || resolved.startsWith('/sdcard') || resolved.startsWith('/storage')
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // /ping 和 /info 免认证（用于自动发现）
  if (url.pathname === '/ping') {
    return json(res, 200, { status: 'ok', timestamp: new Date().toISOString() })
  }
  if (url.pathname === '/info') {
    return json(res, 200, {
      version: 2,
      ip: getLocalIP(),
      port: PORT,
      token: AUTH_TOKEN,
      hostname: os.hostname() || '',
      home: HOME,
    })
  }

  if (req.headers['x-auth-token'] !== AUTH_TOKEN) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const method = req.method

  try {

    // 执行命令
    if (url.pathname === '/exec' && method === 'POST') {
      const body = await parseBody(req)
      if (!body.command) return json(res, 400, { error: 'command required' })
      try {
        const stdout = execSync(body.command, {
          cwd: body.cwd ? expandHome(body.cwd) : HOME,
          timeout: body.timeout || 30000,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
        })
        json(res, 200, { stdout: stdout || '', stderr: '', exitCode: 0 })
      } catch (e) {
        json(res, 200, {
          stdout: e.stdout || '',
          stderr: e.stderr || '',
          exitCode: typeof e.code === 'number' ? e.code : 1,
        })
      }
      return
    }

    // 读取文件
    if (url.pathname === '/fs/read') {
      const p = url.searchParams.get('path')
      if (!p || !isSafePath(p)) return json(res, 400, { error: 'Invalid path' })
      const resolved = expandHome(p)
      if (!fs.existsSync(resolved)) return json(res, 404, { error: 'File not found' })
      return json(res, 200, { content: fs.readFileSync(resolved, 'utf-8') })
    }

    // 写入文件
    if (url.pathname === '/fs/write' && method === 'POST') {
      const body = await parseBody(req)
      if (!body.path || !isSafePath(body.path)) return json(res, 400, { error: 'Invalid path' })
      const resolved = expandHome(body.path)
      fs.mkdirSync(path.dirname(resolved), { recursive: true })
      fs.writeFileSync(resolved, body.content || '', 'utf-8')
      return json(res, 200, { success: true })
    }

    // 列出目录
    if (url.pathname === '/fs/list') {
      const p = expandHome(url.searchParams.get('path') || '~')
      if (!fs.existsSync(p)) return json(res, 404, { error: 'Not found' })
      const items = fs.readdirSync(p).map(name => {
        try {
          const full = path.join(p, name)
          const s = fs.statSync(full)
          return { name, path: full.replace(HOME, '~'), isDirectory: s.isDirectory(), size: s.size, modifiedAt: s.mtime.toISOString() }
        } catch { return null }
      }).filter(Boolean)
      return json(res, 200, { files: items })
    }

    // 文件信息
    if (url.pathname === '/fs/stat') {
      const p = url.searchParams.get('path')
      if (!p || !isSafePath(p)) return json(res, 400, { error: 'Invalid path' })
      const resolved = expandHome(p)
      if (!fs.existsSync(resolved)) return json(res, 404, { error: 'Not found' })
      const s = fs.statSync(resolved)
      return json(res, 200, { name: path.basename(resolved), path: p, isDirectory: s.isDirectory(), size: s.size, modifiedAt: s.mtime.toISOString() })
    }

    // 删除
    if (url.pathname === '/fs/delete' && method === 'DELETE') {
      const p = url.searchParams.get('path')
      if (!p || !isSafePath(p)) return json(res, 400, { error: 'Invalid path' })
      const resolved = expandHome(p)
      if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true })
      return json(res, 200, { success: true })
    }

    // 创建目录
    if (url.pathname === '/fs/mkdir' && method === 'POST') {
      const body = await parseBody(req)
      if (!body.path || !isSafePath(body.path)) return json(res, 400, { error: 'Invalid path' })
      fs.mkdirSync(expandHome(body.path), { recursive: true })
      return json(res, 200, { success: true })
    }

    json(res, 404, { error: 'Not found' })
  } catch (err) {
    json(res, 500, { error: err.message })
  }
}

/* ── 启动 ── */

const ip = getLocalIP()
const server = http.createServer(handleRequest)

server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('╔════════════════════════════════════════════════╗')
  console.log('║        小叶AI Termux 服务器 v2 已启动           ║')
  console.log('╠════════════════════════════════════════════════╣')
  console.log('║                                              ║')
  console.log(`║  地址: http://${ip.padEnd(13)}:${String(PORT).padEnd(4)}          ║`)
  console.log(`║  Token: ${AUTH_TOKEN.substring(0, 20)}...${AUTH_TOKEN.substring(AUTH_TOKEN.length - 4)}           ║`)
  console.log('║                                              ║')
  console.log('║  📱 打开小叶AI App, 点击"自动发现"即可连接      ║')
  console.log('║  🔑 或手动输入 Token: cat ~/.xiaoye-token     ║')
  console.log('║                                              ║')
  console.log('╠════════════════════════════════════════════════╣')
  console.log('║  保持 Termux 在后台运行，不要滑掉               ║')
  console.log('║  退出: Ctrl+C                                 ║')
  console.log('╚════════════════════════════════════════════════╝')
  console.log('')

  // UDP 广播自动发现
  startUDPBroadcast()
  console.log('')
  console.log('  Token 文件: ' + TOKEN_FILE)
  console.log('')
})
