<?php

declare(strict_types=1);

require __DIR__ . '/common.php';
require __DIR__ . '/database.php';

set_api_headers();
handle_preflight();
require_post_method();

$input = read_request_data();

$email = trim((string)($input['email'] ?? ''));
$password = (string)($input['password'] ?? '');
$rememberMeRaw = $input['rememberMe'] ?? false;
$rememberMe = filter_var($rememberMeRaw, FILTER_VALIDATE_BOOL);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(422, [
        'success' => false,
        'message' => 'Invalid email format.',
    ]);
}

if ($password === '') {
    json_response(422, [
        'success' => false,
        'message' => 'Password is required.',
    ]);
}

try {
    $pdo = db_connection();
    $usersTable = users_table_name();

    $sql = "
        SELECT id, email, username, password_hash, first_name, last_name, gender, profile_image_filename
        FROM {$usersTable}
        WHERE email = :email
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['email' => $email]);

    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_response(401, [
            'success' => false,
            'message' => 'Invalid email or password.',
        ]);
    }

    $username = trim((string)($user['username'] ?? ''));
    if ($username === '') {
        $usernameBase = normalize_username_base((string)$user['first_name'], (string)$user['last_name'], (string)$user['email']);
        $username = create_unique_username($pdo, $usersTable, $usernameBase, (int)$user['id']);

        $updateUsernameSql = "UPDATE {$usersTable} SET username = :username WHERE id = :id LIMIT 1";
        $updateUsernameStmt = $pdo->prepare($updateUsernameSql);
        $updateUsernameStmt->execute([
            'username' => $username,
            'id' => (int)$user['id'],
        ]);
    }

    $token = bin2hex(random_bytes(24));
    $expiresInSeconds = $rememberMe ? 2592000 : 86400;

    json_response(200, [
        'success' => true,
        'message' => 'Login successful.',
        'data' => [
            'token' => $token,
            'expiresIn' => $expiresInSeconds,
            'rememberMe' => $rememberMe,
            'user' => [
                'id' => (int)$user['id'],
                'email' => $user['email'],
                'username' => $username,
                'firstName' => $user['first_name'],
                'lastName' => $user['last_name'],
                'gender' => $user['gender'],
                'profileImageFilename' => $user['profile_image_filename'],
                'profileImageUrl' => profile_image_url($user['profile_image_filename']),
            ],
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error during login.',
        'error' => $exception->getMessage(),
    ]);
}
