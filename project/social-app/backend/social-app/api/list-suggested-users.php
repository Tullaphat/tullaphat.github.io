<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$viewerUserId = (int)($input['userId'] ?? 0);
$rawLimit = (int)($input['limit'] ?? 6);
$limit = max(1, min(20, $rawLimit));

try {
    $pdo = db_connection();
    $usersTable = users_table_name();
    $followsTable = follows_table_name();
    $canUseFollowState = $viewerUserId > 0 && follows_table_exists();

    if ($canUseFollowState) {
        $sql = "
            SELECT
                u.id,
                u.username,
                u.first_name,
                u.last_name,
                u.profile_image_filename,
                CASE WHEN f.id IS NULL THEN 0 ELSE 1 END AS is_following
            FROM {$usersTable} u
            LEFT JOIN {$followsTable} f
                ON f.follower_user_id = :viewer_user_id
                AND f.following_user_id = u.id
            WHERE u.id <> :viewer_user_id_exclude
            ORDER BY RAND()
            LIMIT :limit
        ";
    } else {
        $whereSql = '';
        if ($viewerUserId > 0) {
            $whereSql = 'WHERE u.id <> :viewer_user_id_exclude';
        }

        $sql = "
            SELECT
                u.id,
                u.username,
                u.first_name,
                u.last_name,
                u.profile_image_filename,
                0 AS is_following
            FROM {$usersTable} u
            {$whereSql}
            ORDER BY RAND()
            LIMIT :limit
        ";
    }

    $stmt = $pdo->prepare($sql);

    if ($canUseFollowState) {
        $stmt->bindValue(':viewer_user_id', $viewerUserId, PDO::PARAM_INT);
        $stmt->bindValue(':viewer_user_id_exclude', $viewerUserId, PDO::PARAM_INT);
    } elseif ($viewerUserId > 0) {
        $stmt->bindValue(':viewer_user_id_exclude', $viewerUserId, PDO::PARAM_INT);
    }

    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $users = array_map(
        static function (array $row): array {
            return [
                'id' => (int)$row['id'],
                'username' => (string)($row['username'] ?? fallback_username_from_id((int)$row['id'])),
                'firstName' => (string)$row['first_name'],
                'lastName' => (string)$row['last_name'],
                'profileImageFilename' => (string)($row['profile_image_filename'] ?? ''),
                'profileImageUrl' => profile_image_url($row['profile_image_filename'] ?? null),
                'isFollowing' => ((int)$row['is_following']) === 1,
            ];
        },
        $stmt->fetchAll()
    );

    json_response(200, [
        'success' => true,
        'data' => [
            'users' => $users,
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error while loading suggested users.',
        'error' => $exception->getMessage(),
    ]);
}
