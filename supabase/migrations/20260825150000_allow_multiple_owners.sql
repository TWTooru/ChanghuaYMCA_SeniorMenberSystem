begin;

-- 移除 owner 的單一唯一索引，允許多位最高管理員共存。
drop index if exists public.app_user_roles_single_owner_idx;

commit;
