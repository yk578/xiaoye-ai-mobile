# 小叶AI手机端 — 设计文档

## 概述

将小叶AI桌面端（Electron+React+TS）移植到 Android 手机端（Expo React Native）。
定位：**移动开发助手** — 口袋版 AI 编程工具，能读代码、写代码、执行命令、开发项目。

## 核心架构

```
┌──────────────────────────────┐
│  小叶AI App (UI + AI 大脑)     │
│  Exop React Native            │
│                               │
│  ┌─ Screens ───────────────┐  │
│  │  Chat / Files / Mem /   │  │
│  │  Settings               │  │
│  └─────────────────────────┘  │
│  ┌─ Services ──────────────┐  │
│  │  AI对话 / 记忆 / 许可    │  │
│  │  TermuxClient(HTTP API) │  │
│  └─────────────────────────┘  │
│  ┌─ Core (纯TS复制桌面端) ─┐  │
│  │  Provider / EventBus    │  │
│  │  Token / 向量/ 权限     │  │
│  └─────────────────────────┘  │
└──────────┬───────────────────┘
           │ localhost:2324 (HTTP)
           ▼
┌──────────────────────────────┐
│  Termux 服务器 (执行引擎)      │
│  Node.js + Express            │
│                               │
│  - bash / node / python       │
│  - git / npm / pip            │
│  - 完整 Linux 文件系统        │
│  - ~/projects/ 项目目录       │
└──────────────────────────────┘
```

App 通过 HTTP API 调用 Termux 执行引擎，Termux 负责所有「重的」操作：
文件读写、命令执行、git 操作、编译运行。

## Termux 通信协议

**传输层：** HTTP on localhost:2324
**认证：** 随机 Token（App 生成，Termux 读取）

### API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/ping` | 健康检查，返回 Termux 是否就绪 |
| POST | `/exec` | 执行 shell 命令（含超时） |
| GET | `/fs/read?path=` | 读取文件内容 |
| POST | `/fs/write` | 写入文件（body: `{path, content}`） |
| DELETE | `/fs/delete?path=` | 删除文件 |
| GET | `/fs/list?path=` | 列出目录 |
| GET | `/fs/stat?path=` | 获取文件信息 |
| POST | `/fs/mkdir` | 创建目录 |

### 命令执行格式

```json
// POST /exec
{"command": "node --version", "timeout": 10000, "cwd": "~/projects"}

// 响应
{"stdout": "v22.0.0\n", "stderr": "", "exitCode": 0}
```

## 功能范围

### ✅ 桌面端核心能力（通过 Termux 实现）

| 功能 | 实现方式 |
|------|---------|
| Read/Write/Edit 文件 | `/fs/read` + `/fs/write` |
| Glob 搜索 | `find` + `/exec` |
| Grep 搜索 | `grep -r` + `/exec` |
| Bash 执行 | `/exec` |
| Git 操作 | `git` + `/exec` |
| 安装依赖 | `npm/pip` + `/exec` |
| 编译运行代码 | `node/python/gcc` + `/exec` |
| WebSearch/WebFetch | 直接在 App 内 fetch |

### ✅ 保留的桌面端功能（不依赖 Termux）
- LLM 对话（流式 SSE，多 Provider）
- Provider 抽象层（DeepSeek/OpenAI/SiliconFlow 等）
- 记忆系统（expo-sqlite + FTS5 + 分层摘要）
- 模板库 + 快捷操作
- 激活许可（38 元买断 / 8 元月费）
- 事件总线
- Token 预算 + 预处理
- 配置存储（expo-sqlite）

### ⚠️ 适配
- **MCP 客户端**：仅 WebSocket 远程连接
- **权限系统**：底部 Sheet 弹窗
- **新手引导**：包含 Termux 初始设置步骤

### ❌ 砍掉
- Electron IPC（替换为直接函数调用）
- 窗口管理
- 桌面端特有的 UI 组件（TopBar 模型标签等）

## UI 结构

```
DrawerNavigator (侧边栏导航)
├── ChatScreen (主页)
│   ├── FlatList (消息列表 → MarkdownRenderer)
│   ├── StreamingIndicator
│   └── InputBar
├── FilesScreen (文件管理)
│   ├── FileBrowser (Termux 文件系统树)
│   └── CodeEditor (简单文本编辑)
├── MemoryScreen (记忆)
│   ├── ConversationList
│   └── MemoryManager
└── SettingsScreen (设置)
    ├── ProviderConfig (多API Key)
    ├── TermuxSetup (连接状态 + 设置指引)
    ├── ThemeToggle
    └── LicenseActivation
```

## Termux 用户设置流程

1. 用户从 F-Droid 安装 Termux
2. 在 Settings → TermuxSetup 页面拿到一键设置脚本
3. 在 Termux 里粘贴运行（安装 Node.js + 启动服务器）
4. App 自动检测到 Termux 服务器在线，开始使用

## 关键技术决策

### 流式通信
React Native Hermes 不支持 `ReadableStream`。
→ 使用 `XMLHttpRequest.onprogress` 手动解析 SSE。
封装为和桌面端一致的 `AsyncGenerator<StreamChunk>` 接口。

### SQLite 存储
桌面端用 sql.js（WASM），手机端用 expo-sqlite（原生）。
FTS5 替代 FTS4。

### 页面路由
React Navigation v7 + DrawerNavigator（侧边栏导航）。

### 部署方式
开发阶段：Expo Go 预览
发布：EAS Build 打 APK 侧载发布

## 文件结构

```
src/
├── core/                    # 纯TS，直接复制桌面端
│   ├── provider/
│   │   ├── types.ts
│   │   ├── openai-compatible.ts
│   │   ├── registry.ts
│   │   ├── workload-router.ts
│   │   └── model-context.ts
│   ├── memory/
│   │   ├── summarizer.ts
│   │   ├── token-budget.ts
│   │   ├── token-preprocessor.ts
│   │   └── vector-search.ts
│   ├── permission/
│   │   ├── permission-engine.ts
│   │   └── permission-store.ts
│   └── event-bus.ts
├── services/                # 适配层
│   ├── chat-service.ts      # SSE流式对话
│   ├── memory-store.ts      # expo-sqlite
│   ├── config-store.ts      # expo-sqlite 配置
│   ├── termux-client.ts     # Termux HTTP API客户端
│   ├── tool-executor.ts     # 工具执行（映射到Termux或Expo）
│   └── license-store.ts     # 许可逻辑
├── screens/
│   ├── ChatScreen.tsx
│   ├── FilesScreen.tsx
│   ├── MemoryScreen.tsx
│   └── SettingsScreen.tsx
├── components/
│   ├── MarkdownRenderer.tsx
│   ├── StreamingIndicator.tsx
│   ├── InputBar.tsx
│   ├── ProviderConfig.tsx
│   └── LicenseDialog.tsx
├── hooks/
│   ├── useChat.ts
│   └── useConfig.ts
├── types/
│   └── index.ts
├── App.tsx
├── navigation.tsx
└── termux-server/           # Termux 服务器端脚本
    └── server.js
```
