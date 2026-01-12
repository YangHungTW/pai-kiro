# Memory System

Personal AI 的記憶系統，讓 AI 能夠跨 session 學習和記憶。

## 目錄結構

```
memory/
├── history/          # 不可變的歷史記錄
│   ├── sessions/     # Session 摘要
│   ├── decisions/    # 重要決策記錄
│   ├── research/     # 研究輸出
│   └── learnings/    # 學習時刻
│
├── learning/         # 依階段整理的學習
│   ├── OBSERVE/      # 觀察階段的洞見
│   ├── THINK/        # 思考階段的假設
│   ├── PLAN/         # 規劃階段的策略
│   ├── BUILD/        # 建構階段的標準
│   ├── EXECUTE/      # 執行階段的經驗
│   └── VERIFY/       # 驗證階段的方法
│
├── state/            # 即時狀態
│   ├── active-work.json    # 當前進行中的工作
│   ├── context.json        # 當前上下文
│   └── preferences.json    # 動態學習的偏好
│
├── signals/          # 信號與模式
│   ├── patterns.jsonl      # 重複出現的模式
│   ├── failures.jsonl      # 失敗記錄
│   └── feedback.jsonl      # 用戶反饋
│
└── work/             # 進行中的工作目錄
    └── [Task_Timestamp]/   # 每個任務一個目錄
```

## 使用方式

### 記錄 Session
Session 結束時，stop-hook 會自動記錄摘要到 `history/sessions/`。

### 記錄決策
重要決策應記錄到 `history/decisions/`：
```markdown
# Decision: [標題]
Date: 2026-01-13
Context: [背景]
Decision: [決定]
Rationale: [理由]
```

### 記錄學習
學習到的經驗記錄到對應階段：
```markdown
# Learning: [標題]
Date: 2026-01-13
Phase: EXECUTE
Insight: [洞見]
Application: [如何應用]
```

### 追蹤狀態
`state/active-work.json` 追蹤當前工作：
```json
{
  "current_task": "實作 memory 系統",
  "project": "pai-kiro",
  "started_at": "2026-01-13T10:00:00Z",
  "context": ["memory", "hooks", "state"]
}
```
