# Backend API (Deploy to /social-app/api)

This folder contains PHP endpoints for auth and posts.

## Deployment path

On real hosting, place these files so they are reachable at:
- `https://playground.rankongpor.com/social-app/api/login.php`
- `https://playground.rankongpor.com/social-app/api/register.php`
- `https://playground.rankongpor.com/social-app/api/create-post.php`
- `https://playground.rankongpor.com/social-app/api/list-posts.php`
- `https://playground.rankongpor.com/social-app/api/delete-post.php`
- `https://playground.rankongpor.com/social-app/api/toggle-like.php`
- `https://playground.rankongpor.com/social-app/api/toggle-bookmark.php`
- `https://playground.rankongpor.com/social-app/api/list-bookmarked-posts.php`
- `https://playground.rankongpor.com/social-app/api/add-comment.php`
- `https://playground.rankongpor.com/social-app/api/list-comments.php`
- `https://playground.rankongpor.com/social-app/api/delete-comment.php`
- `https://playground.rankongpor.com/social-app/api/search-users.php`
- `https://playground.rankongpor.com/social-app/api/toggle-follow.php`
- `https://playground.rankongpor.com/social-app/api/list-following-users.php`
- `https://playground.rankongpor.com/social-app/api/list-user-posts.php`

## Local test with MAMP

Yes, you can test on your PC by putting this `backend` folder in MAMP `htdocs`.

Recommended local path:
- `/Applications/MAMP/htdocs/social-app/api`

That means locally your endpoints will be:
- `http://localhost:8888/social-app/api/login.php`
- `http://localhost:8888/social-app/api/register.php`
- `http://localhost:8888/social-app/api/create-post.php`
- `http://localhost:8888/social-app/api/list-posts.php`
- `http://localhost:8888/social-app/api/delete-post.php`
- `http://localhost:8888/social-app/api/toggle-like.php`
- `http://localhost:8888/social-app/api/toggle-bookmark.php`
- `http://localhost:8888/social-app/api/list-bookmarked-posts.php`
- `http://localhost:8888/social-app/api/add-comment.php`
- `http://localhost:8888/social-app/api/list-comments.php`
- `http://localhost:8888/social-app/api/delete-comment.php`
- `http://localhost:8888/social-app/api/search-users.php`
- `http://localhost:8888/social-app/api/toggle-follow.php`
- `http://localhost:8888/social-app/api/list-following-users.php`
- `http://localhost:8888/social-app/api/list-user-posts.php`

If your MAMP Apache port is not `8888`, replace the port in frontend config.

## Frontend mode switching

Frontend now supports 2 modes in `app-config.js`:
- `local` -> `http://localhost:8888/social-app/api`
- `production` -> `https://playground.rankongpor.com/social-app/api`

Ways to switch:
1. Set default mode in `app-config.js`:
	- `mode: "local"` for MAMP testing
	- `mode: "production"` for real host
2. Runtime via URL query:
	- `index.html?mode=local`
	- `index.html?mode=production`
3. Runtime via browser console:
	- `setAppMode("local")`
	- `setAppMode("production")`
	- then refresh the page

## Database

Configured in `config.php`:
- host: `localhost`
- user: `root`
- pass: `root`
- db: `rankongp_playground`

Table prefix rule is `social-app_*`, implemented as table:
- `social-app_users`
- `social-app_posts`
- `social-app_post_photos`
- `social-app_post_likes`
- `social-app_post_bookmarks`
- `social-app_post_comments`
- `social-app_follows`

`social-app_users` now includes a unique `username` column.

If your table already exists, run migration SQL once:

```sql
ALTER TABLE `social-app_users`
	ADD COLUMN `username` VARCHAR(64) DEFAULT NULL AFTER `email`;

UPDATE `social-app_users`
SET `username` = CONCAT('user', `id`)
WHERE `username` = '' OR `username` IS NULL;

ALTER TABLE `social-app_users`
	MODIFY COLUMN `username` VARCHAR(64) NOT NULL,
	ADD UNIQUE KEY `uniq_username` (`username`);
```

Import `schema.sql` once before first use.

## Request format

Both endpoints accept JSON (`application/json`) and normal form POST.

### POST /register.php
Required fields:
- `email`
- `password`
- `firstName`
- `lastName`
- `gender` (`female`, `male`, `other`)

### POST /login.php
Required fields:
- `email`
- `password`
Optional:
- `rememberMe` (boolean-like)

### POST /create-post.php
Required fields:
- `userId`

Optional fields:
- `content` (text)
- `photos[]` (multipart image files)

Rule:
- At least one of `content` or `photos[]` must be provided.

### POST /list-posts.php
Optional fields:
- `limit` (default `30`, max `100`)

### POST /delete-post.php
Required fields:
- `userId`
- `postId`

Rules:
- Only the owner of the post can delete it.
- When a post is deleted, related photo files under `uploads/posts` are deleted too.

### POST /toggle-like.php
Required fields:
- `userId`
- `postId`

Returns:
- `liked` (boolean)
- `likeCount` (number)

### POST /toggle-bookmark.php
Required fields:
- `userId`
- `postId`

Returns:
- `bookmarked` (boolean)
- `bookmarkCount` (number)

### POST /list-bookmarked-posts.php
Required fields:
- `userId`

Optional fields:
- `limit` (default `50`, max `100`)

Behavior:
- Returns only posts bookmarked by `userId`.

### POST /add-comment.php
Required fields:
- `userId`
- `postId`
- `content`

Returns:
- created `comment`
- `commentCount`

### POST /list-comments.php
Required fields:
- `postId`

Optional fields:
- `limit` (default `50`, max `100`)

### POST /delete-comment.php
Required fields:
- `userId`
- `commentId`

Rules:
- Allowed if requester is comment owner OR post owner.
- Returns latest `commentCount` for that post.

### POST /search-users.php
Required fields:
- `userId`
- `query`

Optional fields:
- `limit` (default `20`, max `50`)

Behavior:
- Searches users by first name, last name, or full name.
- Includes `isFollowing` per result for current viewer.

### POST /toggle-follow.php
Required fields:
- `userId`
- `targetUserId`

Behavior:
- Toggles follow/unfollow for the target user.

### POST /list-following-users.php
Required fields:
- `userId`

Optional fields:
- `limit` (default `100`, max `200`)

Behavior:
- Returns users currently followed by `userId`.

### POST /list-user-posts.php
Required fields:
- `profileUsername`

Optional fields:
- `userId` (viewer for like/bookmark flags)
- `limit` (default `30`, max `100`)

Behavior:
- Returns only posts created by `profileUsername`.

### Timeline behavior
`list-posts.php` now filters feed to:
- your own posts
- posts from users you follow
