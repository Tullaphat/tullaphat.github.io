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

if ($userId <= 0 || $postId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId and postId are required.',
    ]);
}

try {
    $pdo = db_connection();
    $postsTable = posts_table_name();
    $postBookmarksTable = post_bookmarks_table_name();

    $postCheckSql = "SELECT id FROM {$postsTable} WHERE id = :post_id LIMIT 1";
    $postCheckStmt = $pdo->prepare($postCheckSql);
    $postCheckStmt->execute(['post_id' => $postId]);

    if (!$postCheckStmt->fetch()) {
        json_response(404, [
            'success' => false,
            'message' => 'Post not found.',
        ]);
    }

    $findSql = "
        SELECT id
        FROM {$postBookmarksTable}
        WHERE user_id = :user_id AND post_id = :post_id
        LIMIT 1
    ";
    $findStmt = $pdo->prepare($findSql);
    $findStmt->execute([
        'user_id' => $userId,
        'post_id' => $postId,
    ]);
    $existing = $findStmt->fetch();

    $bookmarked = false;

    if ($existing) {
        $deleteSql = "DELETE FROM {$postBookmarksTable} WHERE id = :id LIMIT 1";
        $deleteStmt = $pdo->prepare($deleteSql);
        $deleteStmt->execute(['id' => (int)$existing['id']]);
    } else {
        $insertSql = "
            INSERT INTO {$postBookmarksTable} (user_id, post_id)
            VALUES (:user_id, :post_id)
        ";
        $insertStmt = $pdo->prepare($insertSql);
        $insertStmt->execute([
            'user_id' => $userId,
            'post_id' => $postId,
        ]);
        $bookmarked = true;
    }

    $countSql = "SELECT COUNT(*) AS total FROM {$postBookmarksTable} WHERE post_id = :post_id";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute(['post_id' => $postId]);
    $bookmarkCount = (int)($countStmt->fetch()['total'] ?? 0);

    json_response(200, [
        'success' => true,
        'data' => [
            'postId' => $postId,
            'bookmarked' => $bookmarked,
            'bookmarkCount' => $bookmarkCount,
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error while toggling bookmark.',
        'error' => $exception->getMessage(),
    ]);
}
