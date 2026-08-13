<?php

require_once __DIR__ . '/database.php';

/*
|--------------------------------------------------------------------------
| Authentication configuration
|--------------------------------------------------------------------------
*/

define('SESSION_DURATION', 8 * 60 * 60); // 5 minutes


/*
|--------------------------------------------------------------------------
| Start PHP session
|--------------------------------------------------------------------------
*/

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}


/*
|--------------------------------------------------------------------------
| Create application login session
|--------------------------------------------------------------------------
|
| This stores the database login session ID in the PHP session.
|
*/

function createLoginSession(int $userId): string
{
    global $pdo;

    $token = bin2hex(random_bytes(32));

    $expiresAt = date(
        'Y-m-d H:i:s',
        time() + SESSION_DURATION
    );

    $sql = "
        INSERT INTO login_sessions
        (
            user_id,
            session_token,
            login_at,
            last_activity_at,
            expires_at,
            status
        )
        VALUES
        (
            ?,
            ?,
            NOW(),
            NOW(),
            ?,
            'active'
        )
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        $userId,
        $token,
        $expiresAt
    ]);

    $_SESSION['session_token'] = $token;

    return $token;
}


/*
|--------------------------------------------------------------------------
| Get currently authenticated user
|--------------------------------------------------------------------------
*/

function getAuthenticatedUser(): ?array
{
    global $pdo;

    if (empty($_SESSION['session_token'])) {
        return null;
    }

    $token = $_SESSION['session_token'];

    $sql = "
        SELECT
            u.id,
            u.google_id,
            u.email,
            u.first_name,
            u.last_name,
            u.profile_picture,
            u.account_status,

            ls.id AS login_session_id,
            ls.session_token,
            ls.login_at,
            ls.last_activity_at,
            ls.expires_at,
            ls.status AS session_status

        FROM login_sessions ls

        INNER JOIN users u
            ON u.id = ls.user_id

        WHERE ls.session_token = ?
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$token]);

    $user = $stmt->fetch();

    if (!$user) {
        unset($_SESSION['session_token']);
        return null;
    }

    // Account blocked/disabled
    if ($user['account_status'] !== 'active') {
        logoutUser();
        return null;
    }

    // Session already marked inactive
    if ($user['session_status'] !== 'active') {
        unset($_SESSION['session_token']);
        return null;
    }

    // EXACT 5-MINUTE EXPIRATION
    if (strtotime($user['expires_at']) <= time()) {

        expireLoginSession(
            $user['session_token']
        );

        return null;
    }

    /*
     * IMPORTANT:
     * Do NOT update expires_at here.
     *
     * The expiration time is fixed from login.
     */

    return $user;
}


/*
|--------------------------------------------------------------------------
| Require login
|--------------------------------------------------------------------------
*/

function requireLogin(): array
{
    $user = getAuthenticatedUser();

    if (!$user) {

        http_response_code(401);

        header('Content-Type: application/json');

        echo json_encode([
            'success' => false,
            'message' => 'Your session has expired. Please log in again.',
            'code' => 'SESSION_EXPIRED'
        ]);

        exit;
    }

    return $user;
}


/*
|--------------------------------------------------------------------------
| Expire login session
|--------------------------------------------------------------------------
*/

function expireLoginSession(string $token): void
{
    global $pdo;

    $stmt = $pdo->prepare("
        UPDATE login_sessions
        SET
            status = 'expired',
            logged_out_at = NOW()
        WHERE session_token = ?
        AND status = 'active'
    ");

    $stmt->execute([$token]);

    unset($_SESSION['session_token']);
}


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

function logoutUser(): void
{
    global $pdo;

    if (!empty($_SESSION['session_token'])) {

        $stmt = $pdo->prepare("
            UPDATE login_sessions
            SET
                status = 'logged_out',
                logged_out_at = NOW()
            WHERE session_token = ?
            AND status = 'active'
        ");

        $stmt->execute([
            $_SESSION['session_token']
        ]);
    }

    unset($_SESSION['session_token']);
}