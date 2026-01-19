# Memory System

Personal AI 的記憶系統，讓 AI 能夠跨 session 學習和記憶。

## 目錄結構

```
memory/
├── LEARNING/             # 結構化學習（主要學習存儲）
│   ├── SYSTEM/           # 工具/系統層面的學習
│   │   └── YYYY-MM/      # 按月份組織
│   ├── ALGORITHM/        # 執行邏輯/方法論的學習
│   │   └── YYYY-MM/
│   ├── SYNTHESIS/        # 模式分析報告（自動產生）
│   │   └── YYYY-MM/
│   └── SIGNALS/
│       └── ratings.jsonl # 評分數據
│
├── history/              # 不可變的歷史記錄
│   ├── sessions/         # Session 摘要
│   ├── decisions/        # 重要決策記錄
│   └── research/         # 研究輸出
│
├── state/                # 即時狀態
│   └── active-work.json  # 當前進行中的工作
│
└── work/                 # 進行中的工作目錄
    └── [Task_Timestamp]/ # 每個任務一個目錄
```

## 學習分類

### SYSTEM
工具和系統層面的問題與解決方案：
- 指令使用錯誤
- 環境配置問題
- Hook 和 MCP 工具問題
- 權限和安全相關

### ALGORITHM
執行邏輯和方法論的學習：
- Bug 修復經驗
- 架構決策
- 程式碼模式
- 效能優化

### SYNTHESIS
自動產生的模式分析報告：
- 週報（每週一產生）
- 評分趨勢分析
- 重複問題識別
- 改進建議

### SIGNALS
原始信號數據：
- `ratings.jsonl` - 用戶評分記錄

## 使用方式

### 給評分
在對話中輸入 1-10 分：
```
8 - good work
7
6: needs improvement
```

評分會自動記錄到 `LEARNING/SIGNALS/ratings.jsonl`。
低於 6 分會自動觸發學習捕獲。

### 記錄決策
重要決策應記錄到 `history/decisions/`：
```markdown
# Decision: [標題]
Date: 2026-01-19
Context: [背景]
Decision: [決定]
Rationale: [理由]
```

### 追蹤狀態
`state/active-work.json` 追蹤當前工作：
```json
{
  "current_task": "實作 learning 系統",
  "project": "pai-kiro",
  "started_at": "2026-01-19T10:00:00Z",
  "context": ["memory", "hooks", "learning"]
}
```

## 自動行為

- **Session 開始**：載入最近 5 筆 ratings 和 3 筆 learnings
- **Session 結束**：自動捕獲到 `history/sessions/` 或 `LEARNING/`
- **每週一**：產生週報到 `LEARNING/SYNTHESIS/`
- **低評分**：自動建立學習文件
