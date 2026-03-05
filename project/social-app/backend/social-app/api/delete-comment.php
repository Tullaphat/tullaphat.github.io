<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$userId = (int)($input['userId'] ?? 0);
$commentId = (int)($input['commentId'] ?? 0);

if ($userId <= 0 || $commentId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId and commentId are required.',
    ]);
}

try {
    $pdo = db_connection();
    $postsTable = posts_table_name();
    $postCommentsTable = post_comments_table_name();

    $pdo->beginTransaction();

    $findSql = "
        SELECT
            c.id,
            c.user_id AS comment_user_id,
            c.post_id,
            p.user_id AS post_user_id
        FROM {$postCommentsTable} c
        INNER JOIN {$postsTable} p ON p.id = c.post_id
        WHERE c.id = :comment_id
        LIMIT 1
        FOR UPDATE
    ";

    $findStmt = $pdo->prepare($findSql);
    $findStmt->execute(['comment_id' => $commentId]);
    $commentRow = $findStmt->fetch();

    if (!$commentRow) {
        $pdo->rollBack();
        json_response(404, [
            'success' => false,
            'message' => 'Comment not found.',
        ]);
    }

    $commentOwnerId = (int)$commentRow['comment_user_id'];
    $postOwnerId = (int)$commentRow['post_user_id'];
    $postId = (int)$commentRow['post_id'];

    $canDelete = ($userId === $commentOwnerId) || ($userId === $postOwnerId);

    if (!$canDelete) {
        $pdo->rollBack();
        json_response(403, [
            'success' => false,
            'message' => 'Only post owner or comment owner can delete this comment.',
        ]);
    }

    $deleteSql = "DELETE FROM {$postCommentsTable} WHERE id = :comment_id LIMIT 1";
    $deleteStmt = $pdo->prepare($deleteSql);
    $deleteStmt->execute(['comment_id' => $commentId]);

    $countSql = "SELECT COUNT(*) AS total FROM {$postCommentsTable} WHERE post_id = :post_id";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute(['post_id' => $postId]);
    $commentCount = (int)($countStmt->fetch()['total'] ?? 0);

    $pdo->commit();

    json_response(200, [
        'success' => true,
        'message' => 'Comment deleted successfully.',
        'data' => [
            'postId' => $postId,
            'commentId' => $commentId,
            'commentCount' => $commentCount,
        ],
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_response(500, [
        'success' => false,
        'message' => 'Database error while deleting comment.',
        'error' => $exception->getMessage(),
    ]);
}
