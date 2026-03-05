<?php

declare(strict_types=1);

function set_api_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

function handle_preflight(): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function json_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function read_request_data(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw ?: '{}', true);

        return is_array($decoded) ? $decoded : [];
    }

    return $_POST;
}

function require_post_method(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(405, [
            'success' => false,
            'message' => 'Method not allowed. Use POST.',
        ]);
    }
}

function parse_bool(mixed $value): bool
{
    return filter_var($value, FILTER_VALIDATE_BOOL) === true;
}

function app_base_url(): string
{
    $isHttps = (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
        (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
    );

    $scheme = $isHttps ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');

    return sprintf('%s://%s%s', $scheme, $host, $scriptDir);
}

function profile_image_url(?string $filename): ?string
{
    if ($filename === null || $filename === '') {
        return null;
    }

    return app_base_url() . '/uploads/profile/' . rawurlencode($filename);
}

function post_image_url(?string $filename): ?string
{
    if ($filename === null || $filename === '') {
        return null;
    }

    return app_base_url() . '/uploads/posts/' . rawurlencode($filename);
}

function normalize_username_base(string $firstName, string $lastName, string $email): string
{
    $base = strtolower(trim($firstName . ' ' . $lastName));
    $base = preg_replace('/[^a-z0-9]+/', '', $base ?? '') ?? '';

    if ($base === '') {
        $emailLocal = strtolower(trim((string)strtok($email, '@')));
        $base = preg_replace('/[^a-z0-9]+/', '', $emailLocal ?? '') ?? '';
    }

    if ($base === '') {
        return 'user';
    }

    return substr($base, 0, 24);
}

function fallback_username_from_id(int $userId): string
{
    return 'user' . max(1, $userId);
}

function create_unique_username(PDO $pdo, string $usersTable, string $base, ?int $excludeUserId = null): string
{
    $cleanBase = preg_replace('/[^a-z0-9]+/', '', strtolower(trim($base)) ?? '') ?? '';
    $cleanBase = $cleanBase !== '' ? substr($cleanBase, 0, 24) : 'user';

    for ($suffix = 0; $suffix < 1000; $suffix++) {
        $candidate = $suffix === 0 ? $cleanBase : substr($cleanBase, 0, max(1, 24 - strlen((string)$suffix))) . $suffix;

        $sql = "SELECT id FROM {$usersTable} WHERE username = :username LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['username' => $candidate]);
        $existing = $stmt->fetch();

        if (!$existing) {
            return $candidate;
        }

        if ($excludeUserId !== null && (int)$existing['id'] === $excludeUserId) {
            return $candidate;
        }
    }

    return 'user' . bin2hex(random_bytes(4));
}
