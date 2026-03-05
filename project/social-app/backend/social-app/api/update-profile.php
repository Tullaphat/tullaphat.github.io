<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();

$userId = (int)($input['userId'] ?? 0);
$email = trim((string)($input['email'] ?? ''));
$username = strtolower(trim((string)($input['username'] ?? '')));
$firstName = trim((string)($input['firstName'] ?? ''));
$lastName = trim((string)($input['lastName'] ?? ''));
$gender = strtolower(trim((string)($input['gender'] ?? '')));
$password = (string)($input['password'] ?? '');
$removeProfileImage = parse_bool($input['removeProfileImage'] ?? false);

$allowedGenders = ['female', 'male', 'other'];

if ($userId <= 0) {
    json_response(422, [
        'success' => false,
        'message' => 'Valid userId is required.',
    ]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(422, [
        'success' => false,
        'message' => 'Invalid email format.',
    ]);
}

if (!preg_match('/^[a-z0-9_]{3,30}$/', $username)) {
    json_response(422, [
        'success' => false,
        'message' => 'Username must be 3-30 chars using lowercase letters, numbers, or underscore.',
    ]);
}

if ($firstName === '' || $lastName === '') {
    json_response(422, [
        'success' => false,
        'message' => 'First name and last name are required.',
    ]);
}

if (!in_array($gender, $allowedGenders, true)) {
    json_response(422, [
        'success' => false,
        'message' => 'Gender must be female, male, or other.',
    ]);
}

if ($password !== '' && strlen($password) < 8) {
    json_response(422, [
        'success' => false,
        'message' => 'Password must be at least 8 characters when provided.',
    ]);
}

$uploadedProfile = $_FILES['profilePicture'] ?? null;

try {
    $pdo = db_connection();
    $usersTable = users_table_name();

    $findUserSql = "
        SELECT id, email, username, first_name, last_name, gender, profile_image_filename
        FROM {$usersTable}
        WHERE id = :id
        LIMIT 1
    ";

    $findUserStmt = $pdo->prepare($findUserSql);
    $findUserStmt->execute(['id' => $userId]);
    $existingUser = $findUserStmt->fetch();

    if (!$existingUser) {
        json_response(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    $checkEmailSql = "
        SELECT id
        FROM {$usersTable}
        WHERE email = :email AND id <> :id
        LIMIT 1
    ";

    $checkEmailStmt = $pdo->prepare($checkEmailSql);
    $checkEmailStmt->execute([
        'email' => $email,
        'id' => $userId,
    ]);

    if ($checkEmailStmt->fetch()) {
        json_response(409, [
            'success' => false,
            'message' => 'Email is already used by another account.',
        ]);
    }

    $checkUsernameSql = "
        SELECT id
        FROM {$usersTable}
        WHERE username = :username AND id <> :id
        LIMIT 1
    ";

    $checkUsernameStmt = $pdo->prepare($checkUsernameSql);
    $checkUsernameStmt->execute([
        'username' => $username,
        'id' => $userId,
    ]);

    if ($checkUsernameStmt->fetch()) {
        json_response(409, [
            'success' => false,
            'message' => 'Username is already used by another account.',
        ]);
    }

    $newFilename = $existingUser['profile_image_filename'];
    $uploadDir = __DIR__ . '/uploads/profile';

    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Cannot create upload directory.');
    }

    if (is_array($uploadedProfile) && ($uploadedProfile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        if (($uploadedProfile['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            json_response(422, [
                'success' => false,
                'message' => 'Profile upload failed.',
            ]);
        }

        $tmpName = (string)($uploadedProfile['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            json_response(422, [
                'success' => false,
                'message' => 'Invalid uploaded profile image payload.',
            ]);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($tmpName) ?: '';

        $allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
        ];

        if (!in_array($mimeType, $allowedMimeTypes, true)) {
            json_response(422, [
                'success' => false,
                'message' => 'Only JPG, PNG, WEBP, and GIF are allowed.',
            ]);
        }

        $ext = optimized_image_extension($mimeType);

        $newFilename = sprintf(
            'user-%d-%s-%s.%s',
            $userId,
            date('YmdHis'),
            bin2hex(random_bytes(4)),
            $ext
        );

        $destination = $uploadDir . '/' . $newFilename;
        if (!optimize_uploaded_image($tmpName, $destination, $mimeType, [
            'max_width' => 1024,
            'max_height' => 1024,
            'jpeg_quality' => 84,
            'webp_quality' => 80,
            'png_compression' => 8,
        ])) {
            throw new RuntimeException('Cannot save uploaded profile image.');
        }

        $oldFilename = $existingUser['profile_image_filename'] ?? '';
        if ($oldFilename !== '' && $oldFilename !== $newFilename) {
            $oldPath = $uploadDir . '/' . $oldFilename;
            if (is_file($oldPath)) {
                @unlink($oldPath);
            }
        }
    } elseif ($removeProfileImage) {
        $oldFilename = $existingUser['profile_image_filename'] ?? '';
        if ($oldFilename !== '') {
            $oldPath = $uploadDir . '/' . $oldFilename;
            if (is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        $newFilename = null;
    }

    $fields = [
        'email = :email',
        'username = :username',
        'first_name = :first_name',
        'last_name = :last_name',
        'gender = :gender',
        'profile_image_filename = :profile_image_filename',
    ];

    $params = [
        'id' => $userId,
        'email' => $email,
        'username' => $username,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'gender' => $gender,
        'profile_image_filename' => $newFilename,
    ];

    if ($password !== '') {
        $fields[] = 'password_hash = :password_hash';
        $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    }

    $updateSql = sprintf(
        'UPDATE %s SET %s WHERE id = :id',
        $usersTable,
        implode(', ', $fields)
    );

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute($params);

    json_response(200, [
        'success' => true,
        'message' => 'Profile updated successfully.',
        'data' => [
            'user' => [
                'id' => $userId,
                'email' => $email,
                'username' => $username,
                'firstName' => $firstName,
                'lastName' => $lastName,
                'gender' => $gender,
                'profileImageFilename' => $newFilename,
                'profileImageUrl' => profile_image_url($newFilename),
            ],
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error during profile update.',
        'error' => $exception->getMessage(),
    ]);
} catch (RuntimeException $exception) {
    json_response(500, [
        'success' => false,
        'message' => $exception->getMessage(),
    ]);
}
