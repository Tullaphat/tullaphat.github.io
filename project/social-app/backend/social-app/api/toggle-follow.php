<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$followerUserId = (int)($input['userId'] ?? 0);
$followingUserId = (int)($input['targetUserId'] ?? 0);

if ($followerUserId <= 0 || $followingUserId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId and targetUserId are required.',
    ]);
}

if ($followerUserId === $followingUserId) {
    json_response(422, [
        'success' => false,
        'message' => 'You cannot follow yourself.',
    ]);
}

try {
    $pdo = db_connection();
    $usersTable = users_table_name();
    $followsTable = follows_table_name();

    $existsSql = "SELECT id FROM {$usersTable} WHERE id = :id LIMIT 1";
    $existsStmt = $pdo->prepare($existsSql);

    $existsStmt->execute(['id' => $followerUserId]);
    $followerExists = $existsStmt->fetch();

    $existsStmt->execute(['id' => $followingUserId]);
    $targetExists = $existsStmt->fetch();

    if (!$followerExists || !$targetExists) {
        json_response(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    $findSql = "
        SELECT id
        FROM {$followsTable}
        WHERE follower_user_id = :follower_user_id
          AND following_user_id = :following_user_id
        LIMIT 1
    ";

    $findStmt = $pdo->prepare($findSql);
    $findStmt->execute([
        'follower_user_id' => $followerUserId,
        'following_user_id' => $followingUserId,
    ]);

    $existing = $findStmt->fetch();
    $isFollowing = false;

    if ($existing) {
        $deleteSql = "DELETE FROM {$followsTable} WHERE id = :id LIMIT 1";
        $deleteStmt = $pdo->prepare($deleteSql);
        $deleteStmt->execute(['id' => (int)$existing['id']]);
    } else {
        $insertSql = "
            INSERT INTO {$followsTable} (follower_user_id, following_user_id)
            VALUES (:follower_user_id, :following_user_id)
        ";
        $insertStmt = $pdo->prepare($insertSql);
        $insertStmt->execute([
            'follower_user_id' => $followerUserId,
            'following_user_id' => $followingUserId,
        ]);

        $isFollowing = true;
    }

    json_response(200, [
        'success' => true,
        'data' => [
            'targetUserId' => $followingUserId,
            'isFollowing' => $isFollowing,
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error while updating follow status.',
        'error' => $exception->getMessage(),
    ]);
}
