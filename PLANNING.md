# PaiKiro - Kiro CLI 版 Personal AI Infrastructure

## 專案目標

將 PaiLang 的 Personal AI Infrastructure 移植到 Kiro CLI，讓開啟 Kiro CLI 時能像 PaiLang 一樣運作。

---

## Claude Code vs Kiro CLI 架構對照

| 功能 | Claude Code | Kiro CLI |
|------|-------------|----------|
| 全域設定目錄 | `~/.claude/` | `~/.kiro/` |
| AI 指令/身份 | `CLAUDE.md` | `.kiro/steering/*.md` |
| Hooks | `~/.claude/hooks/*.ts` | agent config 中的 `hooks` |
| MCP 設定 | `~/.claude.json` | `~/.kiro/settings/mcp.json` |
| 自訂指令 | `~/.claude/commands/` | `/agent` slash commands |
| Skills | `~/.claude/skills/` | agents + steering files |

---

## 專案結構規劃

```
pai-kiro/
├── .kiro/                    # 專案設定（同步到專案）
│   ├── steering/             # Steering files（AI 行為定義）
│   │   ├── product.md        # 產品/身份定義
│   │   ├── tech.md           # 技術偏好
│   │   └── structure.md      # 專案結構說明
│   └── settings/
│       └── mcp.json          # 專案層級 MCP
│
├── pai-kiro/                 # 全域設定（同步到 ~/.kiro）
│   ├── steering/             # 全域 steering files
│   │   ├── identity.md       # PaiLang 身份（對應 CORE/SKILL.md）
│   │   ├── stack.md          # 技術偏好（對應 CoreStack.md）
│   │   └── contacts.md       # 聯絡人（對應 Contacts.md）
│   ├── settings/
│   │   └── mcp.json          # MCP 設定（anytype + github）
│   └── agents/
│       └── pai.json          # PaiLang agent 定義
│
├── scripts/
│   └── sync.ts               # push/pull 同步腳本
│
├── PLANNING.md               # 此規劃文件
├── README.md                 # 專案說明
└── package.json              # Bun 專案設定
```

---

## MCP 設定

只需兩個 MCP servers：

### 1. Anytype
```json
{
  "anytype": {
    "command": "npx",
    "args": ["-y", "@anthropic/anytype-mcp-server"],
    "env": {
      "ANYTYPE_API_KEY": "${ANYTYPE_API_KEY}"
    }
  }
}
```

### 2. GitHub
```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@anthropic/github-mcp-server"],
    "env": {
      "GITHUB_TOKEN": "${GITHUB_TOKEN}"
    }
  }
}
```

---

## Steering Files 對應

| PaiLang (Claude Code) | PaiKiro (Kiro CLI) |
|-----------------------|---------------------|
| `CLAUDE.md` | `.kiro/steering/product.md` |
| `skills/CORE/SKILL.md` | `steering/identity.md` |
| `skills/CORE/CoreStack.md` | `steering/stack.md` |
| `skills/CORE/Contacts.md` | `steering/contacts.md` |

---

## Agent 定義

建立 `pai.json` agent：

```json
{
  "name": "pai",
  "description": "PaiLang - Yang's Personal AI Assistant",
  "model": "claude-sonnet-4",
  "tools": ["read", "write", "bash", "glob", "grep"],
  "allowedTools": ["*"],
  "resources": [
    "file://.kiro/steering/**/*.md"
  ],
  "prompt": "你是 PaiLang，Yang 的個人 AI 助理。請遵循 steering files 中的身份定義和偏好設定。",
  "hooks": {
    "agentSpawn": [],
    "stop": []
  },
  "includeMcpJson": true
}
```

---

## 同步機制

```bash
# 推送設定到 ~/.kiro
bun run sync push

# 從 ~/.kiro 拉取設定
bun run sync pull

# 檢視狀態
bun run sync status
```

---

## 實作步驟

### Phase 1: 基礎結構
- [ ] 建立目錄結構
- [ ] 撰寫 steering files（移植自 PaiLang）
- [ ] 建立 MCP 設定（anytype + github）
- [ ] 建立 pai agent

### Phase 2: 同步腳本
- [ ] 實作 sync.ts（push/pull/status）
- [ ] 處理 .env 環境變數分離

### Phase 3: 測試驗證
- [ ] 測試 `kiro-cli --agent pai` 啟動
- [ ] 驗證 MCP 連接（anytype, github）
- [ ] 驗證 steering files 載入

---

## 預設使用 pai agent

### 方案 1: Shell Alias（推薦）

在 `~/.zshrc` 或 `~/.bashrc` 加入：

```bash
alias kiro='kiro-cli --agent pai'
```

這樣直接執行 `kiro` 就會使用 pai agent。

### 方案 2: 全域 Steering 取代 Agent

不用 custom agent，直接把 PaiLang 身份定義放在全域 steering：

```
~/.kiro/
├── steering/
│   ├── identity.md    # PaiLang 身份
│   ├── stack.md       # 技術偏好
│   └── contacts.md    # 聯絡人
└── settings/
    └── mcp.json       # anytype + github
```

這樣每次啟動 `kiro-cli` 都會自動載入這些 steering files，不需要指定 agent。

**建議採用方案 2**，因為：
- 更簡單，不需要 alias
- 全域 steering 會自動套用到所有對話
- 專案層級的 `.kiro/steering/` 可以覆蓋全域設定

---

## 最終專案結構（採用方案 2）

```
pai-kiro/
├── pai-kiro/                 # 同步到 ~/.kiro
│   ├── steering/
│   │   ├── identity.md       # PaiLang 身份
│   │   ├── stack.md          # 技術偏好
│   │   └── contacts.md       # 聯絡人
│   └── settings/
│       ├── mcp.json          # anytype + github
│       └── .env              # secrets（gitignored）
│
├── scripts/
│   └── sync.ts               # push/pull 同步
│
├── .gitignore
├── PLANNING.md
├── README.md
└── package.json
```

---

## 啟動方式

```bash
# 直接啟動，自動載入 ~/.kiro/steering/ 的 PaiLang 身份
kiro-cli

# 在任何專案目錄都會是 PaiLang
cd any-project
kiro-cli
```

---

## 注意事項

1. **Kiro CLI 沒有 skills 系統** - 用 steering files + agents 替代
2. **Hooks 定義在 agent 中** - 不是獨立的 hooks 目錄
3. **MCP 設定格式略有不同** - 使用 `mcpServers` 包裝
4. **Steering files 是 markdown** - 不需要特殊格式，純自然語言
