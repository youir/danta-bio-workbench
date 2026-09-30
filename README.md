# 生物科研工作台

面向生物领域科研博士的研究工作台。支持网页内直接与研究助理对话、生成机制示意图，也保留「生成启动语 → 复制到 Codex / Claude Code」的原有流程。

**通用版**：不含任何个人标识，也不内置任何 API Key —— 使用者自己填自己的 Key。

## 能力

| 模块 | 说明 | 依赖 |
| --- | --- | --- |
| AI 对话 | 7 个研究助理角色（通用、选题、论文、PPT、组会、日报、机制图），流式回复 | 使用者自带的对话模型 Key |
| 机制图出图 | 按主题与证据描述生成示意图草稿，区分证据状态；任务制平台自动轮询进度 | 使用者自带的生图 Key |
| 启动语 | 保留原有流程，生成提示词复制到 Codex / Claude Code | 无 |
| 设置区 | 模型与 API、知识库文件夹与匹配规则、本地数据管理 | 无 |

## 自带 Key（Bring Your Own Key）

本工作台**不内置任何 API Key**。使用者在网页右上角「模型设置」里自行选择平台并填入自己的 Key：

- **对话模型**：Kimi 官方（Moonshot）、或任意 OpenAI 兼容服务
- **图片生成**：ToAPIs（任务制，自动轮询）、或任意 OpenAI 兼容同步接口

Key 只保存在使用者本机浏览器（`localStorage`），随请求临时交给服务端转发；服务端不落盘、不记录、不回传。因此公开分享同一个链接时，每个人的 Key 互不可见。

## 配置（可选）

只有在**自部署或本机调试**时，才需要在服务端放一份兜底 Key。公开分享时不需要。

```bash
cp .env.example .env
```

```ini
# 对话模型兜底（OpenAI 兼容协议）
KIMI_API_KEY=
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k3
# 留空 = 不下发 temperature（推荐）
KIMI_TEMPERATURE=

# 图片生成兜底
IMAGE_API_KEY=
IMAGE_BASE_URL=
IMAGE_MODEL=gpt-image-2.5-sunburst-official
IMAGE_MODE=async            # async=任务制轮询 | sync=一次性返回
IMAGE_PATH=/images/generations
IMAGE_SIZE=1:1
```

`.env` 已被 `.gitignore` 忽略，不会进入仓库，也不应进入任何发布包。

## 运行

需要 Node.js 20.19 或更新版本。

```bash
npm install
npm run build
npm start            # 默认 http://127.0.0.1:8787
```

前端产物默认从 `dist/` 读取；若不存在则回退到 `web/`（便于部署沙箱排除 `dist/` 时仍可直接托管）。

**开发模式（前端热更新）：**

```bash
npm run dev          # 前端 5173，接口自动代理到 8787
npm run serve        # 另开终端启动接口服务
```

Windows 双击 `启动工作台.bat`，macOS 双击 `启动工作台.command`。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 服务状态与服务端兜底配置情况 |
| GET | `/api/agents` | 可用 agent 角色列表 |
| POST | `/api/chat` | 流式对话（SSE 透传），`{ agentId, messages, credentials }` |
| POST | `/api/image` | 提交生图任务，`{ prompt, size, quality, n, credentials }` |
| POST | `/api/image/status` | 查询异步任务进度，`{ taskId, credentials }` |
| POST | `/api/test` | 用当前凭据拉一次模型列表做连通性校验，`{ channel, credentials }` |

`credentials` = `{ baseUrl, apiKey, model, mode }`，缺失字段回退到服务端环境变量。

## 页面结构

- **开始：** 写下一个研究问题，可直接与研究助理讨论，也可生成启动语；或进入选题、论文、PPT、组会、日报五个独立工作区。
- **AI 对话：** 选择角色后直接对话，支持流式输出与中断。
- **机制图：** 先整理节点与证据，再调用绘图模型生成示意图草稿并下载。
- **研究记录 / 文献与信息源 / 知识库：** 展示真实接入状态；未连接时显示空状态，不展示演示数据。
- **设置：** 模型与 API（含「测试连接」）、知识库文件夹与匹配规则、本地数据管理。

## 已知事项

- ToAPIs 的 `gpt-image-2.5-sunburst` 异步渠道会临时不可用（报「暂不支持异步生成」）；默认选用 `gpt-image-2.5-sunburst-official`，遇到失败换同平台另一模型即可。
- 部分模型（如 Kimi `kimi-k2.7-code`）只接受特定 temperature，因此默认不下发该参数。
