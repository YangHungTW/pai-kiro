# Memory System

你有一個持久的記憶系統，位於 `~/.kiro/memory/`。

## 記憶結構

| 目錄 | 用途 | 何時寫入 |
|------|------|---------|
| `history/sessions/` | Session 摘要 | 自動（stop-hook） |
| `history/decisions/` | 重要決策 | 手動記錄 |
| `history/learnings/` | 學習時刻 | 自動偵測或手動 |
| `learning/[PHASE]/` | 依階段的學習 | 手動整理 |
| `state/active-work.json` | 當前工作 | 工作開始/結束時 |
| `signals/` | 模式偵測 | 自動記錄 |
| `work/` | 進行中任務 | 大型任務時 |

## 使用原則

### 1. 主動查詢記憶
開始新任務前，查看相關的歷史記錄：
```bash
ls ~/.kiro/memory/history/sessions/
cat ~/.kiro/memory/state/active-work.json
```

### 2. 記錄重要決策
做出架構或設計決策時，記錄到 `history/decisions/`：
```markdown
# Decision: 選擇 X 而非 Y
Date: 2026-01-13
Context: [為什麼需要做這個決定]
Decision: [選擇了什麼]
Rationale: [理由]
Alternatives: [考慮過的其他選項]
```

### 3. 更新工作狀態
開始重要任務時，更新 `state/active-work.json`：
```json
{
  "current_task": "實作 memory 系統",
  "project": "pai-kiro",
  "started_at": "2026-01-13T10:00:00Z",
  "context": ["memory", "hooks"]
}
```

### 4. 記錄學習
解決難題或發現重要模式時，記錄到對應階段：
- OBSERVE: 觀察到的模式
- THINK: 假設和推理
- PLAN: 規劃策略
- BUILD: 建構標準
- EXECUTE: 執行經驗
- VERIFY: 驗證方法

## 自動行為

- **Session 結束**: stop-hook 自動記錄摘要
- **學習偵測**: 包含 "problem", "solved", "discovered" 等關鍵字的 session 會標記為 LEARNING
