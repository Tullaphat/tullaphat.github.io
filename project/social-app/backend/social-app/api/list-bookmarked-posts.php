<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$viewerUserId = (int)($input['userId'] ?? 0);
$rawLimit = (int)($input['limit'] ?? 50);
$limit = max(1, min(100, $rawLimit));

if ($viewerUserId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId is required.',
    ]);
}

try {
    $pdo = db_connection();
    $usersTable = users_table_name();
    $postsTable = posts_table_name();
    $postPhotosTable = post_photos_table_name();
    $postBookmarksTable = post_bookmarks_table_name();
    $postLikesTable = post_likes_table_name();
    $postCommentsTable = post_comments_table_name();

    $postsSql = "
        SELECT
            p.id,
            p.user_id,
            p.content,
            p.created_at,
            u.username,
            u.first_name,
            u.last_name,
            u.profile_image_filename,
            b.created_at AS bookmarked_at
        FROM {$postBookmarksTable} b
        INNER JOIN {$postsTable} p ON p.id = b.post_id
        INNER JOIN {$usersTable} u ON u.id = p.user_id
        WHERE b.user_id = :viewer_user_id
        ORDER BY b.created_at DESC, p.id DESC
        LIMIT :limit
    ";

    $postsStmt = $pdo->prepare($postsSql);
    $postsStmt->bindValue(':viewer_user_id', $viewerUserId, PDO::PARAM_INT);
    $postsStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $postsStmt->execute();
    $rows = $postsStmt->fetchAll();

    if (!$rows) {
        json_response(200, [
            'success' => true,
            'data' => [
                'posts' => [],
            ],
        ]);
    }

    $postIds = array_map(
        static fn(array $row): int => (int)$row['id'],
        $rows
    );

    $photoMap = [];
    $placeholders = implode(',', array_fill(0, count($postIds), '?'));

    $photosSql = "
        SELECT post_id, filename
        FROM {$postPhotosTable}
        WHERE post_id IN ({$placeholders})
        ORDER BY sort_order ASC, id ASC
    ";

    $photosStmt = $pdo->prepare($photosSql);
    foreach ($postIds as $index => $postId) {
        $photosStmt->bindValue($index + 1, $postId, PDO::PARAM_INT);
    }
    $photosStmt->execute();

    foreach ($photosStmt->fetchAll() as $photoRow) {
        $postId = (int)$photoRow['post_id'];
        $filename = (string)$photoRow['filename'];

        if (!isset($photoMap[$postId])) {
            $photoMap[$postId] = [];
        }

        $photoMap[$postId][] = $filename;
    }

    $buildCountMap = static function (PDO $pdo, string $tableName, array $ids): array {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "
            SELECT post_id, COUNT(*) AS total
            FROM {$tableName}
            WHERE post_id IN ({$placeholders})
            GROUP BY post_id
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($ids as $index => $id) {
            $stmt->bindValue($index + 1, $id, PDO::PARAM_INT);
        }
        $stmt->execute();

        $map = [];
        foreach ($stmt->fetchAll() as $countRow) {
            $map[(int)$countRow['post_id']] = (int)$countRow['total'];
        }

        return $map;
    };

    $buildViewerFlagMap = static function (PDO $pdo, string $tableName, int $userId, array $ids): array {
        if ($userId <= 0) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "
            SELECT post_id
            FROM {$tableName}
            WHERE user_id = ? AND post_id IN ({$placeholders})
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(1, $userId, PDO::PARAM_INT);

        foreach ($ids as $index => $id) {
            $stmt->bindValue($index + 2, $id, PDO::PARAM_INT);
        }

        $stmt->execute();

        $map = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[(int)$row['post_id']] = true;
        }

        return $map;
    };

    $likeCountMap = $buildCountMap($pdo, $postLikesTable, $postIds);
    $bookmarkCountMap = $buildCountMap($pdo, $postBookmarksTable, $postIds);
    $commentCountMap = $buildCountMap($pdo, $postCommentsTable, $postIds);
    $likedByViewerMap = $buildViewerFlagMap($pdo, $postLikesTable, $viewerUserId, $postIds);
    $bookmarkedByViewerMap = $buildViewerFlagMap($pdo, $postBookmarksTable, $viewerUserId, $postIds);

    $posts = array_map(
        static function (array $row) use (
            $photoMap,
            $likeCountMap,
            $bookmarkCountMap,
            $commentCountMap,
            $likedByViewerMap,
            $bookmarkedByViewerMap
        ): array {
            $postId = (int)$row['id'];
            $filenames = $photoMap[$postId] ?? [];
            $imageUrls = array_values(array_filter(array_map('post_image_url', $filenames)));

            return [
                'id' => $postId,
                'content' => (string)($row['content'] ?? ''),
                'createdAt' => (string)$row['created_at'],
                'bookmarkedAt' => (string)($row['bookmarked_at'] ?? ''),
                'author' => [
                    'id' => (int)$row['user_id'],
                    'username' => (string)($row['username'] ?? fallback_username_from_id((int)$row['user_id'])),
                    'firstName' => (string)$row['first_name'],
                    'lastName' => (string)$row['last_name'],
                    'profileImageFilename' => (string)($row['profile_image_filename'] ?? ''),
                    'profileImageUrl' => profile_image_url($row['profile_image_filename']),
                ],
                'imageUrls' => $imageUrls,
                'reactions' => [
                    'likeCount' => (int)($likeCountMap[$postId] ?? 0),
                    'bookmarkCount' => (int)($bookmarkCountMap[$postId] ?? 0),
                    'commentCount' => (int)($commentCountMap[$postId] ?? 0),
                    'isLiked' => isset($likedByViewerMap[$postId]),
                    'isBookmarked' => isset($bookmarkedByViewerMap[$postId]),
                ],
            ];
        },
        $rows
    );

    json_response(200, [
        'success' => true,
        'data' => [
            'posts' => $posts,
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error while loading bookmarked posts.',
        'error' => $exception->getMessage(),
    ]);
}
