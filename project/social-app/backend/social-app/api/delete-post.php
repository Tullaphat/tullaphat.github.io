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

if ($userId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId is required.',
    ]);
}

if ($postId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid postId is required.',
    ]);
}

$uploadDir = __DIR__ . '/uploads/posts';
$photoFilenames = [];

try {
    $pdo = db_connection();
    $postsTable = posts_table_name();
    $postPhotosTable = post_photos_table_name();

    $pdo->beginTransaction();

    $findPostSql = "
        SELECT id, user_id
        FROM {$postsTable}
        WHERE id = :post_id
        LIMIT 1
        FOR UPDATE
    ";

    $findPostStmt = $pdo->prepare($findPostSql);
    $findPostStmt->execute(['post_id' => $postId]);
    $post = $findPostStmt->fetch();

    if (!$post) {
        $pdo->rollBack();
        json_response(404, [
            'success' => false,
            'message' => 'Post not found.',
        ]);
    }

    if ((int)$post['user_id'] !== $userId) {
        $pdo->rollBack();
        json_response(403, [
            'success' => false,
            'message' => 'You can only delete your own posts.',
        ]);
    }

    $photoSql = "
        SELECT filename
        FROM {$postPhotosTable}
        WHERE post_id = :post_id
    ";

    $photoStmt = $pdo->prepare($photoSql);
    $photoStmt->execute(['post_id' => $postId]);
    $photoFilenames = array_map(
        static fn(array $row): string => (string)$row['filename'],
        $photoStmt->fetchAll()
    );

    $deletePostSql = "
        DELETE FROM {$postsTable}
        WHERE id = :post_id
        LIMIT 1
    ";

    $deletePostStmt = $pdo->prepare($deletePostSql);
    $deletePostStmt->execute(['post_id' => $postId]);

    $pdo->commit();

    $deletedPhotoCount = 0;

    foreach ($photoFilenames as $filename) {
        if ($filename === '') {
            continue;
        }

        $path = $uploadDir . '/' . $filename;
        if (!is_file($path)) {
            continue;
        }

        if (@unlink($path)) {
            $deletedPhotoCount++;
        }
    }

    json_response(200, [
        'success' => true,
        'message' => 'Post deleted successfully.',
        'data' => [
            'postId' => $postId,
            'deletedPhotoCount' => $deletedPhotoCount,
        ],
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_response(500, [
        'success' => false,
        'message' => 'Database error while deleting post.',
        'error' => $exception->getMessage(),
    ]);
}
