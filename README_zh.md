
![logo](./img/logo-tab.png)

一个面向程序员的日常工具。

[English Version](./README.md) | [中文版本](./README_zh.md) 

## 关于这个项目

NextTools 是一个面向程序员日常使用的工具，尝试把一些常见但分散的工作连接在一起，让使用过程更简单、更直观一些。

在实现过程中，我使用了 **React、Node.js、Next.js** 等技术栈。这些都是我长期工作中实际使用的工具。本项目并不追求“炫技”，更多是偏向稳定、清晰和可维护。

它可能不完美，也还有很多可以改进的地方，但至少是一个我自己愿意每天打开、愿意持续维护的项目。


## 项目概述

NextTools 是一个面向程序员日常使用的工具集，旨在将常见的分散工作整合到一个统一的平台中，使使用过程更简单、更直观。该项目基于 React、Node.js、Next.js 等技术栈构建，采用现代化的前后端分离架构。

## 整体技术架构

### 前端架构

- **框架**: Next.js 16.0.10 (App Router)
- **语言**: TypeScript
- **UI组件库**: React 19.2.1, React DOM 19.2.1
- **样式**: Tailwind CSS
- **状态管理**: 本地组件状态 + Context API
- **国际化**: i18n 国际化支持（中文、英文）

### 后端架构

- **运行时**: Node.js
- **Web框架**: Next.js API Routes
- **WebSocket**: ws 库用于实时通信
- **数据库**: SQLite (Better-SQLite3) 用于存储连接配置
- **服务器**: 自定义 Node.js HTTP 服务器

### 桌面应用封装

- **框架**: Electron 28.0.0
- **打包工具**: electron-builder

## 各模块功能详解

### 1. Redis 模块

**实现功能**:
- Redis 服务器连接管理（单机、集群模式）
- 连接测试与验证
- 数据库浏览（支持多个 DB）
- Key-value 操作（增删改查）
- 支持多种数据类型（String, Hash, List, Set, ZSet）
- Key 搜索与过滤
- 连接配置持久化存储

**技术实现**:
- 使用 ioredis 库进行 Redis 操作
- 支持密码认证、SSL 加密连接
- 支持集群模式连接
- 通过 SQLite 数据库存储连接配置

### 2. Kafka 模块

**实现功能**:
- Kafka 集群连接管理
- Topic 管理（创建、删除、查看）
- 消息浏览器（查看分区、消息内容）
- Consumer Group 管理
- 集群指标监控（Broker 信息、Topic 数量、分区信息）
- 消息发送功能
- 消费滞后监控

**技术实现**:
- 使用 kafkajs 库进行 Kafka 操作
- 支持 SSL/SASL 安全协议
- 支持多 Broker 集群连接
- 通过 WebSocket 实现实时消息消费

### 3. SSH 模块

**实现功能**:
- SSH 连接管理（支持密码和密钥认证）
- Web 终端模拟器（基于 xterm.js）
- SFTP 文件传输功能
- 连接配置持久化存储
- 终端字体、颜色等个性化设置
- 连接测试功能

**技术实现**:
- 使用 ssh2 库进行 SSH 连接
- 使用 @xterm/xterm 和 @xterm/addon-fit 实现 Web 终端
- 通过 WebSocket 实现终端与服务器的双向通信
- 支持密码和私钥两种认证方式

### 4. HTTP/Postman 模块

**实现功能**:
- HTTP 请求构建器（GET、POST、PUT、DELETE 等）
- 请求历史记录管理
- 请求集合管理
- 响应查看器
- 请求参数、头部、认证配置
- 请求环境管理

**技术实现**:
- 基于原生 fetch API 或类似机制
- 请求配置通过 SQLite 数据库存储
- 支持多种认证方式（Basic、Bearer Token 等）
- 支持请求/响应历史记录

### 5. ZooKeeper 模块

**实现功能**:
- ZooKeeper 服务器连接管理（单机、集群模式）
- ZNode 浏览与管理
- 数据查看与编辑
- ZNode 创建与删除（支持递归删除）
- 集群指标监控
- 状态信息查看

**技术实现**:
- 使用 node-zookeeper-client 库进行 ZooKeeper 操作
- 支持四字母命令获取服务器状态
- 实现连接池管理
- 通过 SQLite 数据库存储连接配置

### 6. Elasticsearch 模块

**实现功能**:
- ES 集群连接管理（单机、集群模式）
- 索引管理（创建、删除、查看）
- 索引数据浏览
- 集群健康状态监控
- 索引统计信息查看
- 搜索功能

**技术实现**:
- 使用 @elastic/elasticsearch 库进行 ES 操作
- 支持基本认证和 API Key 认证
- 支持 SSL 连接
- 通过 SQLite 数据库存储连接配置

### 7. Database 模块

**实现功能**:
- 多种数据库连接管理（MySQL、PostgreSQL、SQLite）
- 数据库浏览（查看数据库、表、结构）
- SQL 查询执行
- 表数据浏览（分页）
- 表结构查看
- 数据增删改操作
- 连接测试功能

**技术实现**:
- 使用 mysql2、pg、better-sqlite3 等库支持多种数据库
- 实现数据库连接缓存管理
- SQL 查询参数化防止注入
- 通过 SQLite 数据库存储连接配置

## 架构特点

### 数据持久化
- 所有连接配置通过 SQLite 数据库存储
- 使用 Better-SQLite3 作为数据库引擎
- 数据库文件位置：
  - 开发环境: `data/connections.db`
  - macOS: `~/Library/Application Support/NextTools/connections.db`
  - Windows: `%APPDATA%\NextTools\connections.db`
  - Linux: `~/.config/NextTools/connections.db`

### 连接管理
- 每种类型连接有唯一的 ID 格式（如 redis_xxx、kafka_xxx）
- 连接配置序列化存储
- 支持连接收藏和环境标记

### 实时通信
- SSH 终端通过 WebSocket 实现实时交互
- 支持心跳机制保持连接稳定
- 消息编码处理

### 安全考虑
- 敏感信息（如密码、私钥）加密存储（取决于具体实现）
- 连接超时和重试机制
- 输入参数验证

## 本地开发与调试

### 前置条件
- Node.js（建议版本 20.9.0 或更高）
- npm 或 yarn 包管理器
- Git 版本控制工具

### 快速开始

1. **克隆仓库**
   ```bash
   git clone <仓库地址>
   cd next-tools
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   这将启动 Next.js 开发服务器，访问地址为 `http://localhost:3000`

### 开发命令说明

- **Web 开发模式**: `npm run dev`
  - 启动 Next.js 开发服务器
  - 为前端更改提供热重载
  - 运行自定义 Node.js 服务器处理 API 路由

- **Electron 开发模式**: `npm run electron:dev`
  - 同时启动 Web 服务器和 Electron 应用
  - 自动打开桌面应用程序
  - 为 Web 和 Electron 组件提供热重载

- **代码检查**: `npm run lint`
  - 运行 ESLint 检查代码质量
  - 帮助维护一致的编码标准

### 项目结构概览

```
next-tools/
├── app/                    # Next.js App Router 页面和组件
├── electron/              # Electron 主进程文件
├── lib/                   # 共享工具库
├── scripts/               # 构建和工具脚本
├── i18n/                  # 国际化文件
├── img/                   # 图片资源
├── data/                  # SQLite 数据库文件（运行时创建）
├── server.js             # 自定义 Node.js 服务器
└── package.json          # 项目依赖和脚本
```

### 调试技巧

1. **前端调试**
   - 使用浏览器开发者工具（F12）检查 React 组件
   - 启用 React DevTools 扩展获得更好的组件调试体验
   - 检查浏览器控制台的 JavaScript 错误

2. **后端/API 调试**
   - 服务器日志输出到运行 `npm run dev` 的终端
   - 可以通过浏览器或 Postman 等工具直接测试 API 路由
   - 检查终端输出的数据库连接问题

3. **Electron 调试**
   - 使用 `npm run electron:dev` 进行开发
   - 使用 `Ctrl/Cmd + Shift + I` 打开 Electron 开发者工具
   - 主进程日志显示在终端中

4. **数据库调试**
   - 数据库文件位置：`data/connections.db`
   - 使用 SQLite 浏览器工具检查数据库内容
   - 连接配置存储在 `connections` 表中

### 常见开发场景

- **添加新模块**：在 `app/api/` 中创建新的 API 路由和对应的前端组件
- **修改现有功能**：大部分业务逻辑在 `lib/` 目录中
- **UI 更改**：修改 `app/components/` 中的组件
- **国际化**：更新 `i18n/locales/` 中的 JSON 文件

### 故障排除

如果遇到问题：
1. 确保所有依赖已安装：`npm install`
2. 清除 Next.js 缓存：`rm -rf .next`
3. 检查 Node.js 版本兼容性
4. 验证 3000 端口是否可用
5. 查看终端输出的错误信息

## 前端界面布局

- **主页**: 功能卡片导航
- **工作区**: 集成所有工具模块
- **响应式设计**: 适配不同屏幕尺寸
- **国际化**: 支持中英文切换

## 截图展示

### 主要功能界面

<div align="center">

#### 会话管理界面
![会话管理](./img/session.png)

#### Redis 管理界面
![Redis 管理](./img/redis.png)

#### Kafka 管理界面
![Kafka 管理](./img/kafka.png)

#### SSH 终端界面
![SSH 终端](./img/ssh.png)

#### HTTP/Postman 界面
![HTTP/Postman](./img/http.png)

#### ZooKeeper 管理界面
![ZooKeeper 管理](./img/zookeeper.png)

#### Elasticsearch 管理界面
![Elasticsearch 管理](./img/elastic.png)

#### 数据库管理界面
![数据库管理](./img/database.png)

</div>

---

## 为什么这个项目值得一个 Star ⭐

如果你觉得这个工具在设计和实现上，体现了一点对程序员日常工作的理解；  
如果你认同那种不追风口、不堆概念、只是把事情踏实做完的方式；  
那么，一个 Star 就已经是对这个项目最好的鼓励了。

---

## 关于我

我曾在公司中承担过架构相关的工作，对系统设计、服务拆分和工程化有比较完整的实践经验。

日常使用的语言包括 **Golang、Python**，同时也持续关注和学习 **AI 相关方向**，更多是从工程落地和实际使用的角度出发。

我不太擅长包装自己，也不太喜欢夸大技术能力。能确定的是：

- 习惯把事情做完整  
- 把问题解决清楚  
- 对代码和系统长期负责  

如果你正在寻找一名可以 **远程协作** 的程序员，也欢迎通过邮箱联系我：

📧 **calvinliuki@gmail.com**

不一定非要有结果，聊聊项目、技术或者想法也都可以。

---

## 最后

开源对我来说不是一个姿态，而是一种选择。

把这个项目放出来，希望它能继续走得比我更远一点。

如果你愿意使用、反馈，或者一起改进它，我都会非常感谢。
