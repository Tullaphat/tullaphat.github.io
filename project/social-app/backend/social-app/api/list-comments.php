<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$postId = (int)($input['postId'] ?? 0);
$rawLimit = (int)($input['limit'] ?? 50);
$limit = max(1, min(100, $rawLimit));

if ($postId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid postId is required.',
    ]);
}

try {
    $pdo = db_connection();
    $usersTable = users_table_name();
    $postsTable = posts_table_name();
    $postCommentsTable = post_comments_table_name();

    $postCheckSql = "SELECT id FROM {$postsTable} WHERE id = :post_id LIMIT 1";
    $postCheckStmt = $pdo->prepare($postCheckSql);
    $postCheckStmt->execute(['post_id' => $postId]);

    if (!$postCheckStmt->fetch()) {
        json_response(404, [
            'success' => false,
            'message' => 'Post not found.',
        ]);
    }

    $commentsSql = "
        SELECT
            c.id,
            c.content,
            c.created_at,
            u.id AS user_id,
            u.username,
            u.first_name,
            u.last_name,
            u.profile_image_filename
        FROM {$postCommentsTable} c
        INNER JOIN {$usersTable} u ON u.id = c.user_id
        WHERE c.post_id = :post_id
        ORDER BY c.created_at ASC, c.id ASC
        LIMIT :limit
    ";

    $commentsStmt = $pdo->prepare($commentsSql);
    $commentsStmt->bindValue(':post_id', $postId, PDO::PARAM_INT);
    $commentsStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $commentsStmt->execute();
    $rows = $commentsStmt->fetchAll();

    $countSql = "SELECT COUNT(*) AS total FROM {$postCommentsTable} WHERE post_id = :post_id";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute(['post_id' => $postId]);
    $commentCount = (int)($countStmt->fetch()['total'] ?? 0);

    $comments = array_map(
        static function (array $row): array {
            return [
                'id' => (int)$row['id'],
                'content' => (string)$row['content'],
                'createdAt' => (string)$row['created_at'],
                'author' => [
                    'id' => (int)$row['user_id'],
                    'username' => (string)($row['username'] ?? fallback_username_from_id((int)$row['user_id'])),
                    'firstName' => (string)$row['first_name'],
                    'lastName' => (string)$row['last_name'],
                    'profileImageFilename' => (string)($row['profile_image_filename'] ?? ''),
                    'profileImageUrl' => profile_image_url($row['profile_image_filename'] ?? null),
                ],
            ];
        },
        $rows
    );

    json_response(200, [
        'success' => true,
        'data' => [
            'postId' => $postId,
            'commentCount' => $commentCount,
            'comments' => $comments,
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error while loading comments.',
        'error' => $exception->getMessage(),
    ]);
}
