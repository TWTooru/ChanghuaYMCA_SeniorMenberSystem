# Safe Project Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the approved local conversation log and frontend build output, then prevent matching conversation logs from reappearing in Git status.

**Architecture:** This is a filesystem and ignore-rule cleanup only. No application, database, dependency, deployment, or documentation behavior changes are included.

**Tech Stack:** Git, PowerShell, `.gitignore`; React/Vite build output under `dashboard/dist/`.

## Global Constraints

- Preserve `dashboard/node_modules/`.
- Preserve all source code, migrations, tests, formal documentation, and configuration files.
- Preserve the existing uncommitted changes in `supabase/functions/admin-users/index.ts` and `supabase/functions/admin-users/index_test.ts`.
- Do not run feature tests or builds; this work changes no runtime logic.
- Delete only the two explicitly approved targets.

---

### Task 1: Verify cleanup targets and working-tree safeguards

**Files:**
- Read: `檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt`
- Read: `dashboard/dist/`
- Read: `supabase/functions/admin-users/index.ts`
- Read: `supabase/functions/admin-users/index_test.ts`

**Interfaces:**
- Consumes: the approved design in `docs/superpowers/specs/2026-07-23-safe-project-cleanup-design.md`.
- Produces: a baseline Git status and confirmation that only the two approved cleanup targets will be removed.

- [ ] **Step 1: Capture the baseline status**

Run:

```powershell
git status --short --branch
```

Expected: the two existing `admin-users` modifications remain visible; the approved conversation log may be visible before the ignore rule is added.

- [ ] **Step 2: Confirm target paths exist**

Run:

```powershell
Test-Path -LiteralPath '檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt'
Test-Path -LiteralPath 'dashboard\dist'
Test-Path -LiteralPath 'dashboard\node_modules'
```

Expected: the first two commands return `True`; the third returns `True` and establishes that `node_modules` is present and must remain untouched.

### Task 2: Add the scoped ignore rule

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the existing `.gitignore` sections for dependencies, data, and tools.
- Produces: a root-level rule `*--conversation=*.txt` that ignores only matching conversation-record text files.

- [ ] **Step 1: Add the exact rule under the IDE and tools section**

Append this line after the existing `*.log` rule:

```gitignore
*--conversation=*.txt
```

- [ ] **Step 2: Verify the rule matches the approved file**

Run:

```powershell
git check-ignore -v -- '檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt'
```

Expected: output identifies `.gitignore` and the `*--conversation=*.txt` rule.

- [ ] **Step 3: Review the diff before deletion**

Run:

```powershell
git diff -- .gitignore
```

Expected: the only diff is the single scoped ignore rule.

### Task 3: Remove approved local artifacts and verify the result

**Files:**
- Delete: `檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt`
- Delete: `dashboard/dist/`

**Interfaces:**
- Consumes: the verified target paths from Task 1 and the ignore rule from Task 2.
- Produces: a clean artifact state while retaining `dashboard/node_modules/` and all pre-existing source modifications.

- [ ] **Step 1: Delete only the approved conversation log**

Run:

```powershell
Remove-Item -LiteralPath '檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt' -Force
```

Expected: the file no longer exists; no other root-level file is touched.

- [ ] **Step 2: Delete only the frontend build output**

Run:

```powershell
Remove-Item -LiteralPath 'dashboard\dist' -Recurse -Force
```

Expected: `dashboard\dist` no longer exists; `dashboard\node_modules` remains present.

- [ ] **Step 3: Verify all cleanup acceptance criteria**

Run:

```powershell
Test-Path -LiteralPath '檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt'
Test-Path -LiteralPath 'dashboard\dist'
Test-Path -LiteralPath 'dashboard\node_modules'
git check-ignore -v -- '檢查架構 agy --conversation=5ea6bdf3-7b94-43f6-b321-ec02dcb08b36.txt'
git status --short --branch
```

Expected: the first two commands return `False`, the third returns `True`, the fourth reports the new ignore rule, and status shows the two pre-existing `admin-users` modifications plus the intended `.gitignore` change (and no deleted tracked files).

- [ ] **Step 4: Commit the cleanup changes**

Run:

```powershell
git add -- .gitignore
git commit -m "chore: remove local project artifacts"
```

Expected: a new cleanup commit containing only `.gitignore`; the deleted targets were untracked/ignored local artifacts and therefore are not committed.

