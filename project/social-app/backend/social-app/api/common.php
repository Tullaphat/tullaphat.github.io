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

function parse_bool($value): bool
{
    return filter_var($value, FILTER_VALIDATE_BOOLEAN) === true;
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

function optimized_image_extension(string $mimeType): string
{
    $mimeType = strtolower(trim($mimeType));

    if ($mimeType === 'image/gif') {
        return 'gif';
    }

    if (function_exists('imagewebp')) {
        return 'webp';
    }

    if ($mimeType === 'image/png') {
        return 'png';
    }

    return 'jpg';
}

function optimize_uploaded_image(string $sourcePath, string $destinationPath, string $mimeType, array $options = []): bool
{
    $maxWidth = (int)($options['max_width'] ?? 1600);
    $maxHeight = (int)($options['max_height'] ?? 1600);
    $jpegQuality = (int)($options['jpeg_quality'] ?? 82);
    $webpQuality = (int)($options['webp_quality'] ?? 80);
    $pngCompression = (int)($options['png_compression'] ?? 8);

    if (strtolower(trim($mimeType)) === 'image/gif') {
        return move_uploaded_file($sourcePath, $destinationPath) || rename($sourcePath, $destinationPath);
    }

    if (!extension_loaded('gd') || !is_file($sourcePath)) {
        return move_uploaded_file($sourcePath, $destinationPath) || rename($sourcePath, $destinationPath);
    }

    $imageInfo = @getimagesize($sourcePath);
    if (!is_array($imageInfo) || !isset($imageInfo[0], $imageInfo[1])) {
        return move_uploaded_file($sourcePath, $destinationPath) || rename($sourcePath, $destinationPath);
    }

    $sourceWidth = (int)$imageInfo[0];
    $sourceHeight = (int)$imageInfo[1];

    if ($sourceWidth <= 0 || $sourceHeight <= 0) {
        return move_uploaded_file($sourcePath, $destinationPath) || rename($sourcePath, $destinationPath);
    }

    $sourceImage = null;
    switch (strtolower($mimeType)) {
        case 'image/jpeg':
            $sourceImage = @imagecreatefromjpeg($sourcePath);
            break;
        case 'image/png':
            $sourceImage = @imagecreatefrompng($sourcePath);
            break;
        case 'image/webp':
            if (function_exists('imagecreatefromwebp')) {
                $sourceImage = @imagecreatefromwebp($sourcePath);
            }
            break;
        case 'image/gif':
            $sourceImage = @imagecreatefromgif($sourcePath);
            break;
    }

    if (!$sourceImage) {
        return move_uploaded_file($sourcePath, $destinationPath) || rename($sourcePath, $destinationPath);
    }

    $scale = min(
        1,
        $maxWidth > 0 ? ($maxWidth / $sourceWidth) : 1,
        $maxHeight > 0 ? ($maxHeight / $sourceHeight) : 1
    );

    $targetWidth = max(1, (int)round($sourceWidth * $scale));
    $targetHeight = max(1, (int)round($sourceHeight * $scale));
    $targetImage = imagecreatetruecolor($targetWidth, $targetHeight);

    if (!$targetImage) {
        imagedestroy($sourceImage);
        return move_uploaded_file($sourcePath, $destinationPath) || rename($sourcePath, $destinationPath);
    }

    $isAlphaImage = in_array(strtolower($mimeType), ['image/png', 'image/webp', 'image/gif'], true);
    if ($isAlphaImage) {
        imagealphablending($targetImage, false);
        imagesavealpha($targetImage, true);
        $transparent = imagecolorallocatealpha($targetImage, 0, 0, 0, 127);
        imagefilledrectangle($targetImage, 0, 0, $targetWidth, $targetHeight, $transparent);
    }

    imagecopyresampled(
        $targetImage,
        $sourceImage,
        0,
        0,
        0,
        0,
        $targetWidth,
        $targetHeight,
        $sourceWidth,
        $sourceHeight
    );

    imagedestroy($sourceImage);

    $destinationSaved = false;
    $destinationExt = strtolower((string)pathinfo($destinationPath, PATHINFO_EXTENSION));

    if ($destinationExt === 'webp' && function_exists('imagewebp')) {
        $destinationSaved = imagewebp($targetImage, $destinationPath, $webpQuality);
    } elseif ($destinationExt === 'jpg' || $destinationExt === 'jpeg') {
        $destinationSaved = imagejpeg($targetImage, $destinationPath, $jpegQuality);
    } elseif ($destinationExt === 'png') {
        $destinationSaved = imagepng($targetImage, $destinationPath, $pngCompression);
    } elseif ($destinationExt === 'gif') {
        $destinationSaved = imagegif($targetImage, $destinationPath);
    }

    imagedestroy($targetImage);

    if ($destinationSaved && is_file($destinationPath)) {
        @unlink($sourcePath);
        return true;
    }

    if (is_file($destinationPath)) {
        @unlink($destinationPath);
    }

    return move_uploaded_file($sourcePath, $destinationPath) || rename($sourcePath, $destinationPath);
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
