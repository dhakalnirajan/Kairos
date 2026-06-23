{
  "upFile": "migrations/1750000000_add_user_avatar.up.sql",
  "downFile": "migrations/1750000000_add_user_avatar.down.sql",
  "manualReviewRequired": false
}

-- up.sql --
ALTER TABLE users ADD COLUMN avatar_url text;

-- down.sql --
ALTER TABLE users DROP COLUMN avatar_url;
