<?php

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/auth.php';

$error = '';

/*
|--------------------------------------------------------------------------
| If already logged in, go to arena
|--------------------------------------------------------------------------
*/

if (getAuthenticatedUser()) {
    header('Location: arena.php');
    exit;
}


/*
|--------------------------------------------------------------------------
| Process development login
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $userId = filter_input(
        INPUT_POST,
        'user_id',
        FILTER_VALIDATE_INT
    );

    if (!$userId) {

        $error = 'Please select a user.';

    } else {

        /*
         * Get the selected user.
         */

        $stmt = $pdo->prepare("
            SELECT
                id,
                google_id,
                email,
                first_name,
                last_name,
                profile_picture,
                account_status
            FROM users
            WHERE id = ?
            LIMIT 1
        ");

        $stmt->execute([$userId]);

        $user = $stmt->fetch();


        if (!$user) {

            $error = 'Selected user does not exist.';

        } elseif ($user['account_status'] !== 'active') {

            $error = 'This user account is blocked.';

        } else {

            /*
             * Remove any existing active development session
             * for this user.
             *
             * This is only for testing.
             */

            $stmt = $pdo->prepare("
                UPDATE login_sessions
                SET
                    status = 'logged_out',
                    logged_out_at = NOW()
                WHERE user_id = ?
                AND status = 'active'
            ");

            $stmt->execute([
                $user['id']
            ]);


            /*
             * Create a brand-new fixed 5-minute session.
             */

            createLoginSession(
                (int) $user['id']
            );


            /*
             * Send user to arena.
             */

            header('Location: arena.php');
            exit;
        }
    }
}


/*
|--------------------------------------------------------------------------
| Get available users
|--------------------------------------------------------------------------
*/

$stmt = $pdo->query("
    SELECT
        id,
        email,
        first_name,
        last_name
    FROM users
    WHERE account_status = 'active'
    ORDER BY first_name, last_name, email
");

$users = $stmt->fetchAll();

?>
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Candon Arena - Development Login</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;

            display: flex;
            align-items: center;
            justify-content: center;

            font-family: Arial, sans-serif;

            background: #f3f4f6;
        }

        .login-card {
            width: 100%;
            max-width: 420px;

            background: white;

            padding: 32px;

            border-radius: 14px;

            box-shadow:
                0 10px 30px rgba(0, 0, 0, 0.10);
        }

        h1 {
            margin-top: 0;
            margin-bottom: 8px;

            font-size: 24px;
        }

        .subtitle {
            margin-bottom: 24px;

            color: #666;

            font-size: 14px;
        }

        label {
            display: block;

            margin-bottom: 8px;

            font-weight: 600;
        }

        select {
            width: 100%;

            padding: 12px;

            border: 1px solid #ccc;

            border-radius: 8px;

            font-size: 15px;

            background: white;
        }

        button {
            width: 100%;

            margin-top: 18px;

            padding: 12px;

            border: 0;

            border-radius: 8px;

            background: #2563eb;

            color: white;

            font-size: 15px;

            font-weight: 600;

            cursor: pointer;
        }

        button:hover {
            background: #1d4ed8;
        }

        .error {
            margin-bottom: 18px;

            padding: 10px 12px;

            border-radius: 8px;

            background: #fee2e2;

            color: #991b1b;

            font-size: 14px;
        }

        .dev-warning {
            margin-top: 20px;

            padding: 10px 12px;

            border-radius: 8px;

            background: #fff7ed;

            color: #9a3412;

            font-size: 13px;
        }

    </style>

</head>

<body>

<div class="login-card">

    <h1>Candon Arena</h1>

    <div class="subtitle">
        Development Login
    </div>

    <?php if ($error): ?>

        <div class="error">
            <?= htmlspecialchars($error) ?>
        </div>

    <?php endif; ?>


    <?php if (empty($users)): ?>

        <div class="error">
            No active users were found in the database.
        </div>

    <?php else: ?>

        <form method="POST">

            <label for="user_id">
                Select test account
            </label>

            <select
                name="user_id"
                id="user_id"
                required
            >

                <option value="">
                    -- Select a user --
                </option>

                <?php foreach ($users as $user): ?>

                    <?php
                    $name = trim(
                        ($user['first_name'] ?? '') .
                        ' ' .
                        ($user['last_name'] ?? '')
                    );

                    if ($name === '') {
                        $name = 'Unnamed user';
                    }
                    ?>

                    <option value="<?= (int) $user['id'] ?>">

                        <?= htmlspecialchars($name) ?>

                        —
                        <?= htmlspecialchars($user['email']) ?>

                    </option>

                <?php endforeach; ?>

            </select>


            <button type="submit">
                Login as Test User
            </button>

        </form>

    <?php endif; ?>


    <div class="dev-warning">
        Development login only.
        This page is for local testing and should be
        removed or disabled before production deployment.
    </div>

</div>

</body>

</html>