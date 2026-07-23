# 安全專案清理設計

**日期：** 2026-07-23  
**專案：** YMCA 學員資訊管理系統  
**狀態：** 已核准，待實作

## 目標

清除已確認的本機暫存檔與建置產物，並防止同格式的對話紀錄再次進入 Git 狀態；不改變應用程式、資料庫或部署行為。

## 變更範圍

### 刪除

| 路徑 | 原因 |
|---|---|
| `檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt` | 未追蹤的工具／對話暫存紀錄，已獲使用者確認可刪除 |
| `dashboard/dist/` | 本機建置產物，已獲使用者確認可刪除；下次建置可重新產生 |

### 修改

在根目錄 `.gitignore` 增加：

```gitignore
*--conversation=*.txt
```

此規則只忽略檔名包含 `--conversation=` 且以 `.txt` 結尾的對話紀錄，不影響一般文字文件。

## 保留與限制

- 保留 `dashboard/node_modules/`，避免不必要的重新安裝。
- 保留所有正式文件、程式碼、migration、測試與設定檔。
- 不修改 `supabase/functions/admin-users/index.ts`、`index_test.ts` 的既有未提交內容。
- 不進行前端元件重排、文件搬移、依賴更新或功能重構。

## 驗收

1. 目標暫存檔與 `dashboard/dist/` 不存在。
2. `.gitignore` 包含精準的對話紀錄忽略規則。
3. `git status --short` 顯示既有 `admin-users` 修改仍在，且不再顯示目標暫存檔。
4. 不執行功能測試；本次沒有執行邏輯變更。

