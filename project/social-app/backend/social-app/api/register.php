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
$firstName = trim((string)($input['firstName'] ?? ''));
$lastName = trim((string)($input['lastName'] ?? ''));
$gender = strtolower(trim((string)($input['gender'] ?? '')));

$allowedGenders = ['female', 'male', 'other'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(422, [
        'success' => false,
        'message' => 'Invalid email format.',
    ]);
}

if (strlen($password) < 8) {
    json_response(422, [
        'success' => false,
        'message' => 'Password must be at least 8 characters.',
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

try {
    $pdo = db_connection();
    $usersTable = users_table_name();

    $checkSql = "SELECT id FROM {$usersTable} WHERE email = :email LIMIT 1";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute(['email' => $email]);

    if ($checkStmt->fetch()) {
        json_response(409, [
            'success' => false,
            'message' => 'Email is already registered.',
        ]);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $usernameBase = normalize_username_base($firstName, $lastName, $email);
    $username = create_unique_username($pdo, $usersTable, $usernameBase);

    $insertSql = "
        INSERT INTO {$usersTable} (email, username, password_hash, first_name, last_name, gender)
        VALUES (:email, :username, :password_hash, :first_name, :last_name, :gender)
    ";

    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'email' => $email,
        'username' => $username,
        'password_hash' => $passwordHash,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'gender' => $gender,
    ]);

    json_response(201, [
        'success' => true,
        'message' => 'Registration successful.',
        'data' => [
            'userId' => (int)$pdo->lastInsertId(),
            'email' => $email,
            'username' => $username,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'gender' => $gender,
        ],
    ]);
} catch (PDOException $exception) {
    json_response(500, [
        'success' => false,
        'message' => 'Database error during registration.',
        'error' => $exception->getMessage(),
    ]);
}
