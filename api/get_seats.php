<?php

require_once '../config/database.php';

header('Content-Type: application/json');

$event_id = 1;

try {

    /*
     * Get all active seats for the event.
     *
     * A seat can have one of three states:
     *
     * available
     * held
     * booked
     */

    $sql = "
        SELECT
            s.id,
            s.seat_code,
            s.section,
            s.row_name,
            s.seat_number,

            CASE

                /* Permanently booked */
                WHEN EXISTS (
                    SELECT 1
                    FROM booking_seats bs
                    INNER JOIN bookings b
                        ON b.id = bs.booking_id
                    WHERE bs.seat_id = s.id
                    AND b.event_id = s.event_id
                    AND b.status = 'confirmed'
                )
                THEN 'booked'

                /* Temporarily held */
                WHEN EXISTS (
                    SELECT 1
                    FROM seat_holds sh
                    WHERE sh.seat_id = s.id
                    AND sh.event_id = s.event_id
                    AND sh.status = 'active'
                    AND sh.expires_at > NOW()
                )
                THEN 'held'

                /* Nothing currently occupying the seat */
                ELSE 'available'

            END AS seat_status

        FROM seats s

        WHERE s.event_id = ?
        AND s.status = 'active'

        ORDER BY s.id
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$event_id]);

    $seats = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'event_id' => $event_id,
        'total_seats' => count($seats),
        'seats' => $seats
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load seat information.'
    ]);
}