-- Round 4: backfill actor_name for historical activity log rows using admin_users.
-- Only updates rows where actor_name is empty/null and a matching admin user exists.
UPDATE activity_log al
SET actor_name = au.name
FROM admin_users au
WHERE (al.actor_name IS NULL OR al.actor_name = '')
  AND lower(al.actor_email) = lower(au.email);

-- Round 4: derive a human-readable display name from the email local part for
-- activity rows that still have no actor_name (e.g. system, test actors).
UPDATE activity_log
SET actor_name = initcap(regexp_replace(split_part(actor_email, '@', 1), '[._-]+', ' ', 'g'))
WHERE (actor_name IS NULL OR actor_name = '')
  AND actor_email <> '';
