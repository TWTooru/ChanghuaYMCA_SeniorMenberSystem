# YMCA社教學員資料庫 — 學員資訊管理系統

學員資料管理、選課紀錄追蹤、統計分析與 Excel 匯出的行政後台系統。

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端框架 | React 19 + Vite |
| 樣式 | Tailwind CSS 3 + 自訂 CSS |
| UI 元件 | shadcn/ui (Base UI) + Lucide Icons |
| 後端服務 | Supabase（Auth / Database / Edge Functions） |
| 資料匯出 | xlsx（SheetJS） |
| 測試 | Vitest + Testing Library |
| Lint | Oxlint |

## 專案結構

```
├── dashboard/          # React 前端應用程式
│   ├── src/
│   │   ├── components/ # UI 元件（按功能分類）
│   │   ├── contexts/   # React Context（認證）
│   │   ├── domain/     # 純商業邏輯（無外部依賴）
│   │   ├── hooks/      # 自訂 React Hooks
│   │   ├── lib/        # 工具函式（Excel / Supabase Client）
│   │   ├── services/   # Supabase API 服務層
│   │   └── fixtures/   # 測試用靜態資料
│   └── public/         # 靜態資源
├── supabase/
│   ├── migrations/     # 資料庫 Migration（9 個）
│   └── functions/      # Edge Functions（admin-users）
└── docs/               # 部署與管理文件
```

## 快速開始

### 前置條件

- Node.js 18+
- Supabase CLI（用於本機開發 / 資料庫推送）

### 安裝與啟動

```bash
# 安裝前端依賴
cd dashboard
npm install

# 設定環境變數
cp .env.example .env.local
# 編輯 .env.local 填入 Supabase URL 與 Anon Key

# 啟動開發伺服器
npm run dev
```

或使用 Windows 啟動腳本：

```bash
啟動系統.bat
```

### 常用指令

```bash
npm run dev      # 啟動開發伺服器
npm run build    # 建置生產版本
npm run test     # 執行測試（240 個）
npm run lint     # 執行程式碼檢查
```

## 功能模組

| 分頁 | 說明 |
|------|------|
| 數據概覽 | KPI 卡片、年齡分佈、課程熱門度圖表 |
| 學員清單與查詢 | 搜尋、篩選、排序、分頁、新增學員 |
| 歷年選課歷程 | 依期別瀏覽選課紀錄、前後測分數 |
| 帳號管理 | 邀請 / 角色變更 / 刪除使用者（僅限 admin） |

## 角色權限

| 角色 | 權限 |
|------|------|
| `admin` | 完整存取（含帳號管理、Excel 同步、匯出） |
| `editor` | 編輯學員資料、新增選課紀錄 |
| `viewer` | 唯讀瀏覽 |

## 部署

詳見 [docs/admin-account-management-setup.md](docs/admin-account-management-setup.md)。

前端建置後部署至 IIS，已含 `web.config` SPA 路由設定。

## 授權

本系統為 YMCA社教學員資料庫內部行政使用。
