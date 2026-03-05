<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$viewerUserId = (int)($input['userId'] ?? 0);
$rawLimit = (int)($input['limit'] ?? 100);
$limit = max(1, min(200, $rawLimit));

if ($viewerUserId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId is required.',
    ]);
}

try {
    if (!follows_table_exists()) {
        json_response(200, [
            'success' => true,
            'data' => [
                'users' => [],
            ],
        ]);
    }

    $pdo = db_connection();
    $usersTable = users_table_name();
    $followsTable = follows_table_name();

    $sql = "
        SELECT
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.profile_image_filename,
            f.created_at AS followed_at
        FROM {$followsTable} f
        INNER JOIN {$usersTable} u ON u.id = f.following_user_id
        WHERE f.follower_user_id = :viewer_user_id
        ORDER BY f.created_at DESC, u.first_name ASC, u.last_name ASC
        LIMIT :limit
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':viewer_user_id', $viewerUserId, PDO::PARAM_INT);
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
                'followedAt' => (string)($row['followed_at'] ?? ''),
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
        'message' => 'Database error while loading following users.',
        'error' => $exception->getMessage(),
    ]);
}
