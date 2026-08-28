# AI 智慧選股研究平台｜UX Baseline v1.0

## Status
GPT UX baseline — Review Required / DO NOT MERGE until Stanley confirms visual acceptance.

## Product Goal
首頁不是一般行情資訊平台，而是 AI 投資經理人的「選股與觀察決策入口」。核心問題：

> 哪些股票值得觀察？為什麼？目標價格在哪裡？目前評分多少？今天相較原推薦有什麼變化？

## Locked UX Direction
- 16:9 desktop-first；iPad responsive。
- 淺色、低疲勞、適合長時間觀看。
- 首頁以 AI 結論、觀察清單、推薦變化、持股與市場環境為主。
- 不把一般個股行情分析塞入首頁。
- 個股完整分析為左側獨立功能。
- AI 選股流程為左側獨立功能，必須揭露各分析工具：原始分數、權重、加權分數、總分。
- AI 觀察清單分六個週期：當沖、短期（2週）、短中期（3–6個月）、中期（6–12個月）、中長期（12–36個月）、長期（36個月以上）。
- 我的持股提供股票代號／名稱、股數、成本輸入入口。
- 股票查詢必須支援「代號」與「股票名稱」。
- 右上角無明確功能的人物／問號區塊移除。
- AI 選股流程不佔用首頁右下角固定空間，改由左側選單進入。

## Data Behaviour
- 市場資料：每日更新。
- AI 觀察清單：原則上每週重新產生／重整。
- 每日更新仍必須重新評估既有推薦，呈現升級、維持、降級、移除等變化。
- AI 必須保留「原推薦」與「最新狀態」供比較與參數修正。
- AI 推薦邏輯由 AI 依既定分析工具與可驗證資料生成，不由 Dashboard UI 猜測。
- UX mock 數字不得視為 Production 市場資料。

## Separation of Responsibilities
- GPT：UX / information architecture / scoring methodology review / QA acceptance。
- Claude Code：依此 Baseline 實作、載入既有 Production Data、串接既有資料流程、測試。
- GitHub：前端程式、文件與資料收集流程的版本管理；不是市場資料的 Production Database。
- Supabase：後續 production data / auth / RLS 層。

## Implementation Constraint
Claude Code 不得因資料串接需求重新設計 UX。若資料欄位不足，新增資料適配層或提出最小必要變更；不可自行改變首頁資訊架構。
