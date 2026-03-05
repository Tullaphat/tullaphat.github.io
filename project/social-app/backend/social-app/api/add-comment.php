<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$userId = (int)($input['userId'] ?? 0);
$postId = (int)($input['postId'] ?? 0);
$content = trim((string)($input['content'] ?? ''));

if ($userId <= 0 || $postId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId and postId are required.',
    ]);
}

if ($content === '') {
    json_response(422, [
        'success' => false,
        'message' => 'Comment content is required.',
    ]);
}

if (mb_strlen($content) > 1000) {
    json_response(422, [
        'success' => false,
        'message' => 'Comment is too long (max 1000 characters).',
    ]);
}

try {
    $pdo = db_connection();
    $usersTable = users_table_name();
    $postsTable = posts_table_name();
    $postCommentsTable = post_comments_table_name();

    $userCheckSql = "SELECT id, username, first_name, last_name, profile_image_filename FROM {$usersTable} WHERE id = :id LIMIT 1";
    $userCheckStmt = $pdo->prepare($userCheckSql);
    $userCheckStmt->execute(['id' => $userId]);
    $user = $userCheckStmt->fetch();

    if (!$user) {
        json_response(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    $postCheckSql = "SELECT id FROM {$postsTable} WHERE id = :post_id LIMIT 1";
    $postCheckStmt = $pdo->prepare($postCheckSql);
    $postCheckStmt->execute(['post_id' => $postId]);

    if (!$postCheckStmt->fetch()) {
        json_response(404, [
            'success' => false,
            'message' => 'Post not found.',
        ]);
    }

    $insertSql = "
        INSERT INTO {$postCommentsTable} (user_id, post_id, content)
        VALUES (:user_id, :post_id, :content)
    ";
    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'user_id' => $userId,
        'post_id' => $postId,
        'content' => $content,
    ]);

    $commentId = (int)$pdo->lastInsertId();

    $selectSql = "
        SELECT id, content, created_at
        FROM {$postCommentsTable}
        WHERE id = :id
        LIMIT 1
    ";
    $selectStmt = $pdo->prepare($selectSql);
    $selectStmt->execute(['id' => $commentId]);
    $comment = $selectStmt->fetch();

    $countSql = "SELECT COUNT(*) AS total FROM {$postCommentsTable} WHERE post_id = :post_id";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute(['post_id' => $postId]);
    $commentCount = (int)($countStmt->fetch()['total'] ?? 0);

    json_response(201, [
        'success' => true,
        'data' => [
            'comment' => [
                'id' => (int)($comment['id'] ?? $commentId),
                'content' => (string)($comment['content'] ?? $content),
                'createdAt' => (string)($comment['created_at'] ?? date('Y-m-d H:i:s')),
                'author' => [
                    'id' => $userId,
                    'username' => (string)($user['username'] ?? fallback_username_from_id($userId)),
                    'firstName' => (string)$user['first_name'],
                    'lastName' => (string)$user['last_name'],
                    'profileImageFilename' => (string)($user['profile_image_filename'] ?? ''),
                    'profileImageUrl' => profile_image_url($user['profile_image_filename'] ?? null),
                ],
            ],
            'commentCount' => $commentCount,
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error while adding comment.',
        'error' => $exception->getMessage(),
    ]);
}
