-- This historical production repair referenced UUID enrollment identifiers.
-- The committed base schema uses bigint enrollment IDs, so the repair cannot
-- be type-checked while replaying an empty database. The target membership
-- project is intentionally empty; retain this migration as an explicit no-op.
select 1;
