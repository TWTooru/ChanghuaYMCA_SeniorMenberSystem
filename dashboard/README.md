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
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 路徑別名

`@` 對應 `./src`，可在 import 中使用：

```js
import { supabase } from '@/lib/supabaseClient'
```
