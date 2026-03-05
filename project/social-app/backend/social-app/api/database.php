<?php

declare(strict_types=1);

function db_config(): array
{
    static $config = null;

    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }

    return $config;
}

function db_connection(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = db_config()['db'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        $db['port'],
        $db['name'],
        $db['charset']
    );

    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function users_table_name(): string
{
    // Prefix contains a hyphen, so table identifiers must be wrapped in backticks.
    return '`' . db_config()['table_prefix'] . 'users`';
}

function posts_table_name(): string
{
    // Prefix contains a hyphen, so table identifiers must be wrapped in backticks.
    return '`' . db_config()['table_prefix'] . 'posts`';
}

function post_photos_table_name(): string
{
    // Prefix contains a hyphen, so table identifiers must be wrapped in backticks.
    return '`' . db_config()['table_prefix'] . 'post_photos`';
}

function post_likes_table_name(): string
{
    // Prefix contains a hyphen, so table identifiers must be wrapped in backticks.
    return '`' . db_config()['table_prefix'] . 'post_likes`';
}

function post_bookmarks_table_name(): string
{
    // Prefix contains a hyphen, so table identifiers must be wrapped in backticks.
    return '`' . db_config()['table_prefix'] . 'post_bookmarks`';
}

function post_comments_table_name(): string
{
    // Prefix contains a hyphen, so table identifiers must be wrapped in backticks.
    return '`' . db_config()['table_prefix'] . 'post_comments`';
}

function follows_table_name(): string
{
    // Prefix contains a hyphen, so table identifiers must be wrapped in backticks.
    return '`' . db_config()['table_prefix'] . 'follows`';
}

function table_exists(string $tableName): bool
{
    $pdo = db_connection();
    $dbName = (string)db_config()['db']['name'];

    $sql = '
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = :table_schema
          AND table_name = :table_name
        LIMIT 1
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'table_schema' => $dbName,
        'table_name' => $tableName,
    ]);

    return (bool)$stmt->fetchColumn();
}

function table_column_exists(string $tableName, string $columnName): bool
{
    $pdo = db_connection();
    $dbName = (string)db_config()['db']['name'];

    $sql = '
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = :table_schema
          AND table_name = :table_name
          AND column_name = :column_name
        LIMIT 1
    ';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'table_schema' => $dbName,
        'table_name' => $tableName,
        'column_name' => $columnName,
    ]);

    return (bool)$stmt->fetchColumn();
}

function follows_table_exists(): bool
{
    $rawTableName = db_config()['table_prefix'] . 'follows';
    return table_exists($rawTableName);
}
