-- 026_user_avatar.sql
-- Add an optional profile picture (avatar) URL to users. The image itself is
-- stored on Cloudinary; this column holds the secure URL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
