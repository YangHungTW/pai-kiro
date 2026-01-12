# PaiKiro

Personal AI Infrastructure for Kiro CLI

## Quick Start

```bash
# 1. 複製 .env 並填入你的 secrets
cp pai-kiro/settings/.env.example pai-kiro/settings/.env

# 2. 編輯 .env 填入你的設定
#    - PAI_USER_NAME / PAI_ASSISTANT_NAME
#    - Anytype 和 GitHub tokens

# 3. 推送設定到 ~/.kiro
bun run push

# 4. 啟動 Kiro CLI（使用 pai agent）
kiro-cli --agent pai
```

## 專案結構

```
pai-kiro/
├── pai-kiro/                 # 同步到 ~/.kiro
│   ├── steering/             # 全域知識
│   │   ├── identity.md       # 身份定義（支援 ${VAR}）
│   │   ├── stack.md          # 技術偏好
│   │   ├── memory.md         # 記憶系統使用說明
│   │   └── contacts.md       # 聯絡人
│   ├── agents/               # Agent 定義
│   │   ├── pai.json          # 主 agent
│   │   ├── commit.json       # Git commit 專家
│   │   ├── explore.json      # 代碼探索專家
│   │   └── review.json       # Code review 專家
│   ├── hooks/                # Hook 腳本
│   ├── skills/               # Skills
│   ├── memory/               # 記憶系統
│   │   ├── history/          # 歷史記錄
│   │   ├── learning/         # 學習整理
│   │   ├── state/            # 即時狀態
│   │   ├── signals/          # 信號偵測
│   │   └── work/             # 進行中工作
│   ├── observability/        # 可觀測性
│   │   └── server.ts         # Dashboard server
│   └── settings/
│       ├── mcp.json          # MCP 設定
│       └── .env              # secrets (gitignored)
│
├── scripts/
│   └── sync.ts               # 同步腳本（含變數替換）
│
└── package.json
```

## 指令

```bash
# 推送設定到 ~/.kiro（會替換 ${VAR} 變數）
bun run push

# 從 ~/.kiro 拉取設定
bun run pull

# 檢視同步狀態
bun run status

# 啟動 Observability Dashboard
bun run ~/.kiro/observability/server.ts
```

## Memory System

跨 session 的記憶系統，讓 AI 能夠學習和記憶。

| 目錄 | 用途 |
|------|------|
| `history/sessions/` | Session 摘要（自動記錄） |
| `history/decisions/` | 重要決策 |
| `history/learnings/` | 學習時刻 |
| `learning/[PHASE]/` | 依階段整理的學習 |
| `state/` | 即時狀態（當前工作、偏好） |
| `signals/` | 模式偵測 |
| `work/` | 進行中的工作目錄 |

詳見 `steering/memory.md`。

## Observability

即時監控 AI 行為的 dashboard。

```bash
# 啟動 server（預設 port 4000）
bun run ~/.kiro/observability/server.ts

# 開啟 dashboard
open http://localhost:4000
```

功能：
- 即時顯示 hook events
- Tool 使用統計
- Session 追蹤

## 環境變數

在 `.env` 中設定：

```bash
# Identity（會替換到 steering 和 agent 檔案）
PAI_USER_NAME=Yang
PAI_ASSISTANT_NAME=PaiLang

# MCP Servers
ANYTYPE_MCP_HEADERS=your_anytype_headers
GITHUB_TOKEN=your_github_token
```

## Agents（Subagents）

| Agent | 用途 | 調用方式 |
|-------|------|---------|
| pai | 主 agent | `kiro-cli --agent pai` |
| commit | Git commit | 「Use commit agent to...」 |
| explore | 代碼探索 | 「Use explore agent to...」 |
| review | Code review | 「Use review agent to...」 |

## Hooks

| Hook | 觸發時機 | 功能 |
|------|---------|------|
| initialize-session | agentSpawn | 初始化 session |
| load-core-context | agentSpawn | 載入核心上下文 |
| security-validator | preToolUse | 安全檢查 |
| update-tab-titles | userPromptSubmit | 更新 tab 標題 |
| stop-hook | stop | 記錄 session 到 memory |

## MCP Servers

| Server | 用途 |
|--------|------|
| anytype | Anytype 筆記整合 |
| github | GitHub 操作 |

## 預設使用 pai agent

在 `~/.zshrc` 加入：

```bash
alias kiro='kiro-cli --agent pai'
```
