# 初次報名自動建立繳費紀錄設計規範

## 目的

在「新增會員與第一筆報名」流程中，行政人員於第二步驟所填寫的紙本收費欄位（預繳金額／編號、學費、教材費、會友費／正式收據編號），目前僅儲存於 `enrollments` 資料表欄位，尚未同步寫入系統的收據資料表（`billing_receipts` 及 `billing_receipt_courses`）。這導致新建立的會員報名無法在「歷年選課歷程」與「繳費紀錄明細」中查閱到對應的繳費明細。

本設計旨在使 `create_student_with_initial_enrollment` RPC 在建立學員、報名與選課資料的同時，於同一個交易中自動建立至多兩筆分組繳費收據，並修正前端領域邏輯以支援單一課程關聯多張收據的資料解析。

---

## 業務邏輯與收據建立規則

### 1. 預繳收據（Prepaid Receipt）
* **觸發條件**：`prepaid_amount`（預繳金額）不為空且整數值大於 0。
* **收據金額**：`prepaid_amount`。
* **收據編號**：`prepaid_receipt_number`（去除前後空白，若為空則為 null）。
* **涵蓋課程**：此初次報名所選修的所有課程（`courses`）。

### 2. 正式費用收據（Formal Fee Receipt）
* **金額計算**：`total_fee = coalesce(tuition_fee, 0) + coalesce(materials_fee, 0) + coalesce(membership_fee, 0)`（學費 + 教材費 + 會友費）。
* **觸發條件**：`total_fee` 大於 0。
* **收據金額**：`total_fee`。
* **收據編號**：`fee_receipt_number`（去除前後空白，若為空則為 null）。
* **涵蓋課程**：此初次報名所選修的所有課程（`courses`）。

### 3. 空值與零金額處理
* 若預繳金額為空或 0，則不建立預繳收據。
* 若正式費用合計為 0，則不建立正式費用收據。
* 原始 `enrollments` 資料表上的 `prepaid_amount`, `prepaid_receipt_number`, `tuition_fee`, `materials_fee`, `membership_fee`, `fee_receipt_number` 欄位仍然完整保留，供歷史與表單對照。

---

## 資料庫結構與 RPC 設計

### 1. 資料約束調整（Table Constraint）
現行 `public.billing_receipt_courses` 定義包含 `course_id bigint not null unique`，限制一門課程只能關聯至一張收據。為支援初次報名同時產生「預繳」與「正式收據」：
* 移除 `course_id` 的唯一約束（UNIQUE constraint）。
* 保留 `PRIMARY KEY (receipt_id, course_id)` 複合主鍵，防止同一張收據重複關聯同一門課。
* 資料庫觸發器 `enforce_billing_receipt_single_enrollment` 依然維持有效：確保同一張收據內的所有課程必須隸屬於同一筆報名紀錄（跨報名保護）。

### 2. 更新 RPC：`create_student_with_initial_enrollment`
在 `public.create_student_with_initial_enrollment` 中：
1. 建立 `students` 學員列。
2. 建立 `enrollments` 報名列。
3. 建立 `courses` 課程明細列。
4. 計算 `v_prepaid_amount` 與 `v_formal_amount`。
5. 若 `v_prepaid_amount > 0`：
   * `insert into public.billing_receipts (amount, invoice_number)` 建立預繳收據。
   * 將該 enrollment 下的所有 `course_id` 插入 `public.billing_receipt_courses`。
6. 若 `v_formal_amount > 0`：
   * `insert into public.billing_receipts (amount, invoice_number)` 建立正式費用收據。
   * 將該 enrollment 下的所有 `course_id` 插入 `public.billing_receipt_courses`。
7. 整體操作維持 `SECURITY DEFINER`，若任一步驟拋出異常或失敗，整筆交易回滾（Atomic）。

---

## 前端領域邏輯與資料流

### 1. 更新 `dashboard/src/domain/enrollmentBilling.js`
* 現行 `normalizeEnrollmentBilling` 在迭代 `courseRows` 時使用 `firstReceipt(course.billing_receipt_courses)`，若一門課有多個收據連結，僅會讀取第一個。
* 修改為：迭代該課程關聯的所有 `billing_receipt_courses` 項目，將每個不為空的 `billing_receipts` 依照 `receipt_id` 去重並加入 `receiptMap`。
* 輸出之 `billingReceipts` 陣列將完整包含預繳與正式費用收據。

### 2. 前端畫面銜接
* **歷年選課歷程（`EnrollmentTab.jsx`）**：`summarizeEnrollmentBilling` 自動彙總 `billingReceipts` 中所有收據的金額與發票號碼。
* **繳費明細對話框（`EnrollmentBillingDetailModal.jsx`）**：列出建立好的預繳與正式費用收據，支援後續手動編輯或刪除。

---

## 測試與驗證計畫

### 1. 資料庫層測試（pgTAP）
* 測試同時包含預繳與正式費用：驗證建立 2 筆 `billing_receipts` 且各自關聯所有課程。
* 測試僅有預繳：驗證僅建立 1 筆預繳收據。
* 測試僅有正式費用：驗證僅建立 1 筆正式收據。
* 測試費用皆為 0 / 空：驗證不建立任何收據。
* 測試交易原子性與異常回滾。

### 2. 前端單元與整合測試
* 測試 `normalizeEnrollmentBilling` 能正確解析單一課程關聯多張收據的場景。
* 測試 `studentService.createStudentWithInitialEnrollment` 與整體報名資料流程。
