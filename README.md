# PaiKiro

PaiLang - Personal AI Infrastructure for Kiro CLI

## Quick Start

```bash
# 1. 複製 .env 並填入你的 secrets
cp pai-kiro/settings/.env.example pai-kiro/settings/.env

# 2. 編輯 .env 填入 Anytype 和 GitHub tokens

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
│   │   ├── identity.md       # PaiLang 身份
│   │   ├── stack.md          # 技術偏好
│   │   └── contacts.md       # 聯絡人
│   ├── agents/               # Agent 定義
│   │   ├── pai.json          # 主 agent（預設）
│   │   ├── commit.json       # Git commit 專家
│   │   ├── explore.json      # 代碼探索專家
│   │   └── review.json       # Code review 專家
│   ├── hooks/                # Hook 腳本
│   │   ├── initialize-session.ts
│   │   ├── load-core-context.ts
│   │   ├── security-validator.ts
│   │   ├── update-tab-titles.ts
│   │   ├── stop-hook.ts
│   │   └── lib/
│   ├── skills/               # Skills
│   │   ├── CORE/
│   │   ├── Browser/
│   │   ├── Prompting/
│   │   ├── Agents/
│   │   └── CreateSkill/
│   └── settings/
│       ├── mcp.json          # MCP 設定模板
│       └── .env              # secrets (gitignored)
│
├── scripts/
│   └── sync.ts               # 同步腳本
│
└── package.json
```

## 指令

```bash
# 推送設定到 ~/.kiro
bun run push

# 從 ~/.kiro 拉取設定
bun run pull

# 檢視同步狀態
bun run status
```

## Agents（Subagents）

| Agent | 用途 | 調用方式 |
|-------|------|---------|
| pai | 主 agent，預設使用 | `kiro-cli --agent pai` |
| commit | Git commit 專家 | 「Use commit agent to...」 |
| explore | 代碼探索 | 「Use explore agent to...」 |
| review | Code review | 「Use review agent to...」 |

## Hooks

| Hook | 觸發時機 | 功能 |
|------|---------|------|
| initialize-session | agentSpawn | 初始化 session |
| load-core-context | agentSpawn | 載入核心上下文 |
| security-validator | preToolUse (shell) | 安全檢查 |
| update-tab-titles | userPromptSubmit | 更新 tab 標題 |
| stop-hook | stop | Session 結束處理 |

## Skills

| Skill | 用途 |
|-------|------|
| CORE | 身份、偏好、聯絡人 |
| Browser | 瀏覽器自動化 |
| Prompting | 模板生成 |
| Agents | 動態 agent 建立 |
| CreateSkill | 建立新 skill |

## MCP Servers

| Server | 用途 |
|--------|------|
| anytype | Anytype 筆記整合 |
| github | GitHub 操作 |

## 預設使用 pai agent

在 `~/.zshrc` 加入 alias：

```bash
alias kiro='kiro-cli --agent pai'
```
