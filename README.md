# AI 智慧選股研究平台（發布版）

此 repo 只存放自動發布的網頁，**請勿直接修改**。
內容由私人主專案 Stock-Analysis-System 的 `public/` 以 `scripts/publish-dashboard.mjs` 產生，
與本機 http://localhost:8080 為同一套程式；在此網站上讀取雲端資料庫（近 150 天）。

來源版本：8861cda8a98bc4b41fe9cc880adc7dd00ba03a1c（見 PUBLISHED.json）

每晚排程監控：`.github/workflows/pipeline-watchdog.yml` 每天 08:30（台北）檢查雲端資料是否已更新到最新交易日，未更新時自動開 issue 通知，恢復後自動關閉（原始檔在主專案 `publish/dashboard-repo/`）。

2026-09-26 以前另外開發的舊版介面保存在分支 `archive/legacy-ui-2026-09`。
