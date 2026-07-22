# 小叶AI 手机端 (xiaoye-ai-mobile)

将小叶AI 桌面端能力移植到 Android 手机端。**移动开发助手** — 口袋版 AI 编程工具，能读代码、写代码、执行命令、开发项目。

## 架构

```
App (Expo React Native)
    │ 本地 HTTP API (localhost:2324)
    ▼
Termux 服务器 (Node.js + Express)
    │ bash / node / python / git / npm
```

App 负责 AI 对话 + 文件浏览，Termux 负责所有「重的」操作。

## 快速开始

### 1. 安装 Termux

从 F-Droid 安装 Termux（推荐，更新更及时）：
- [F-Droid Termux](https://f-droid.org/packages/com.termux/)
- 或 [GitHub Releases](https://github.com/termux/termux-app/releases/latest)

### 2. 一键安装服务器

打开 Termux，粘贴运行：

```bash
curl -sL https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/main/termux-server/setup.sh | bash
```

脚本会自动：安装 Node.js → 下载/创建服务器文件 → 启动服务。

### 3. 连接 App

打开小叶AI App → 设置 → **自动发现**，自动配对。或手动输入服务器 IP 和 Token。

---

**以后启动：** 打开 Termux → 上箭头 + 回车

## 开发

```bash
npm install
npx expo start        # 启动 Expo 开发服务器
npx expo run:android   # 直接构建 APK
```

## 功能

- AI 对话（流式 SSE，多 Provider：DeepSeek / OpenAI / SiliconFlow）
- 文件读写 + Shell 命令执行（通过 Termux）
- 代码搜索（Glob + Grep）
- Web 搜索 + 网页抓取
- 记忆系统（SQLite FTS5）
- 对话历史管理
- 多 API Key 配置

## 技术栈

- **框架：** Expo 56 / React Native 0.85
- **语言：** TypeScript
- **存储：** expo-sqlite
- **导航：** React Navigation (自定义抽屉)
- **执行引擎：** Termux (Node.js HTTP Server)

## License

MIT
