# Dashboard — YMCA 學員資訊管理系統前端

React 19 + Vite 前端應用程式，連接 Supabase 後端服務。

## 開發

```bash
npm install        # 安裝依賴
npm run dev        # 啟動開發伺服器（HMR）
npm run build      # 建置生產版本
npm run test       # 執行 Vitest 測試
npm run lint       # 執行 Oxlint 檢查
npm run preview    # 預覽生產版本
```

## 環境變數

複製 `.env.example` 為 `.env.local` 並填入 Supabase 連線資訊：

```
VITE_SUPABASE_URL=https://nychrjrezpuxwuurpcvh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## 目前部署設定

前端使用 Vite 環境變數，請在 `dashboard/.env.local` 設定：

```dotenv
VITE_SUPABASE_URL=https://nychrjrezpuxwuurpcvh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的 Supabase Publishable Key
```

目標 Supabase 專案 ref 為 `nychrjrezpuxwuurpcvh`。請不要將 Publishable Key 或任何帳號資訊提交到版本控制。

工作人員流程：以 Supabase Auth 登入後，管理員可匯入會員、管理帳號與刪除資料；編輯者可新增及更新會員與報名；檢視者僅能瀏覽與匯出。會員匯入前會顯示新增／更新預覽，確認後才會寫入資料庫。

## 路徑別名

`@` 對應 `./src`，可在 import 中使用：

```js
import { supabase } from '@/lib/supabaseClient'
```
