<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();
$userId = (int)($input['userId'] ?? 0);
$content = trim((string)($input['content'] ?? ''));
$uploadedPhotos = $_FILES['photos'] ?? null;

if ($userId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId is required.',
    ]);
}

$hasPhotos = is_array($uploadedPhotos) && isset($uploadedPhotos['name']);
if ($content === '' && !$hasPhotos) {
    json_response(422, [
        'success' => false,
        'message' => 'Post must have text, photos, or both.',
    ]);
}

$uploadDir = __DIR__ . '/uploads/posts';
$allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];

$normalizeUploads = static function (?array $photos): array {
    if (!is_array($photos) || !isset($photos['name'])) {
        return [];
    }

    $names = $photos['name'];

    if (!is_array($names)) {
        return [[
            'name' => (string)($photos['name'] ?? ''),
            'type' => (string)($photos['type'] ?? ''),
            'tmp_name' => (string)($photos['tmp_name'] ?? ''),
            'error' => (int)($photos['error'] ?? UPLOAD_ERR_NO_FILE),
            'size' => (int)($photos['size'] ?? 0),
        ]];
    }

    $files = [];
    foreach ($names as $index => $name) {
        $files[] = [
            'name' => (string)$name,
            'type' => (string)($photos['type'][$index] ?? ''),
            'tmp_name' => (string)($photos['tmp_name'][$index] ?? ''),
            'error' => (int)($photos['error'][$index] ?? UPLOAD_ERR_NO_FILE),
            'size' => (int)($photos['size'][$index] ?? 0),
        ];
    }

    return $files;
};

$files = $normalizeUploads($uploadedPhotos);
$files = array_values(array_filter($files, static fn(array $file): bool => $file['error'] !== UPLOAD_ERR_NO_FILE));

if ($content === '' && count($files) === 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Post must have text, photos, or both.',
    ]);
}

if (count($files) > 6) {
    json_response(422, [
        'success' => false,
        'message' => 'You can upload at most 6 photos per post.',
    ]);
}

$storedFilenames = [];

try {
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Cannot create post upload directory.');
    }

    $pdo = db_connection();
    $usersTable = users_table_name();
    $postsTable = posts_table_name();
    $postPhotosTable = post_photos_table_name();

    $findUserSql = "SELECT id FROM {$usersTable} WHERE id = :id LIMIT 1";
    $findUserStmt = $pdo->prepare($findUserSql);
    $findUserStmt->execute(['id' => $userId]);

    if (!$findUserStmt->fetch()) {
        json_response(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);

    foreach ($files as $index => $file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            json_response(422, [
                'success' => false,
                'message' => 'One of the photos failed to upload.',
            ]);
        }

        $tmpName = $file['tmp_name'];
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            json_response(422, [
                'success' => false,
                'message' => 'Invalid uploaded photo payload.',
            ]);
        }

        $mimeType = $finfo->file($tmpName) ?: '';
        if (!in_array($mimeType, $allowedMimeTypes, true)) {
            json_response(422, [
                'success' => false,
                'message' => 'Only JPG, PNG, WEBP, and GIF photos are allowed.',
            ]);
        }

        $ext = optimized_image_extension($mimeType);
        $newFilename = sprintf(
            'post-%d-%s-%02d-%s.%s',
            $userId,
            date('YmdHis'),
            $index + 1,
            bin2hex(random_bytes(4)),
            $ext
        );

        $destination = $uploadDir . '/' . $newFilename;
        if (!optimize_uploaded_image($tmpName, $destination, $mimeType, [
            'max_width' => 1600,
            'max_height' => 1600,
            'jpeg_quality' => 82,
            'webp_quality' => 78,
            'png_compression' => 8,
        ])) {
            throw new RuntimeException('Cannot save uploaded post photo.');
        }

        $storedFilenames[] = $newFilename;
    }

    $pdo->beginTransaction();

    $insertPostSql = "
        INSERT INTO {$postsTable} (user_id, content)
        VALUES (:user_id, :content)
    ";

    $insertPostStmt = $pdo->prepare($insertPostSql);
    $insertPostStmt->execute([
        'user_id' => $userId,
        'content' => $content !== '' ? $content : null,
    ]);

    $postId = (int)$pdo->lastInsertId();

    if ($storedFilenames) {
        $insertPhotoSql = "
            INSERT INTO {$postPhotosTable} (post_id, filename, sort_order)
            VALUES (:post_id, :filename, :sort_order)
        ";
        $insertPhotoStmt = $pdo->prepare($insertPhotoSql);

        foreach ($storedFilenames as $order => $filename) {
            $insertPhotoStmt->execute([
                'post_id' => $postId,
                'filename' => $filename,
                'sort_order' => $order,
            ]);
        }
    }

    $selectPostSql = "
        SELECT
            p.id,
            p.user_id,
            p.content,
            p.created_at,
                u.username,
            u.first_name,
            u.last_name,
            u.profile_image_filename
        FROM {$postsTable} p
        INNER JOIN {$usersTable} u ON u.id = p.user_id
        WHERE p.id = :post_id
        LIMIT 1
    ";

    $selectPostStmt = $pdo->prepare($selectPostSql);
    $selectPostStmt->execute(['post_id' => $postId]);
    $createdPost = $selectPostStmt->fetch();

    $pdo->commit();

    json_response(201, [
        'success' => true,
        'message' => 'Post created successfully.',
        'data' => [
            'post' => [
                'id' => $postId,
                'content' => (string)($createdPost['content'] ?? ''),
                'createdAt' => (string)($createdPost['created_at'] ?? date('Y-m-d H:i:s')),
                'author' => [
                    'id' => (int)($createdPost['user_id'] ?? $userId),
                    'username' => (string)($createdPost['username'] ?? fallback_username_from_id((int)$createdPost['user_id'])),
                    'firstName' => (string)($createdPost['first_name'] ?? ''),
                    'lastName' => (string)($createdPost['last_name'] ?? ''),
                    'profileImageFilename' => (string)($createdPost['profile_image_filename'] ?? ''),
                    'profileImageUrl' => profile_image_url($createdPost['profile_image_filename'] ?? null),
                ],
                'imageUrls' => array_values(array_filter(array_map('post_image_url', $storedFilenames))),
            ],
        ],
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    foreach ($storedFilenames as $filename) {
        $path = $uploadDir . '/' . $filename;
        if (is_file($path)) {
            @unlink($path);
        }
    }

    json_response(500, [
        'success' => false,
        'message' => 'Database error while creating post.',
        'error' => $exception->getMessage(),
    ]);
} catch (RuntimeException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    foreach ($storedFilenames as $filename) {
        $path = $uploadDir . '/' . $filename;
        if (is_file($path)) {
            @unlink($path);
        }
    }

    json_response(500, [
        'success' => false,
        'message' => $exception->getMessage(),
    ]);
}
