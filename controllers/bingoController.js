// controllers/bingoController.js
const db = require("../config/db");
const { generateBingoCard } = require("../utils/generateCard");
const engine = require("../socket/engine");

// ------------------------------------------------------
// CREATE ROOM
// ------------------------------------------------------
// exports.createRoom = async (req, res) => {
//   try {
//     const {
//       room_name,
//       entry_fee = 0,
//       max_players = 100,
//       start_in_seconds = 10,
//     } = req.body;

//     const [result] = await db.query(
//       `INSERT INTO bingo_rooms (room_name, entry_fee, max_players, start_time)
//        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
//       [room_name, entry_fee, max_players, start_in_seconds]
//     );

//     const roomId = result.insertId;

//     const [[room]] = await db.query(
//       "SELECT start_time FROM bingo_rooms WHERE id=?",
//       [roomId]
//     );

//     // ⏳ Schedule countdown & drawing
//     engine.scheduleRoomStart(req.io, roomId, room.start_time);

//     res.json({ success: true, room_id: roomId });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ msg: "Server error" });
//   }
// };


exports.createRoom = async (req, res) => {
  try {
    const { room_name, entry_fee = 0, max_players = 100 } = req.body;

    const [result] = await db.query(
      "INSERT INTO bingo_rooms (room_name, entry_fee, max_players, status) VALUES (?, ?, ?, 'waiting')",
      [room_name, entry_fee, max_players]
    );

    res.json({ success: true, room_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};


// ------------------------------------------------------
// GET AVAILABLE ROOMS
// ------------------------------------------------------
// exports.getAvailableRooms = async (req, res) => {
//   const [rooms] = await db.query(
//     "SELECT * FROM bingo_rooms WHERE status='waiting'"
//   );
//   res.json(rooms);
// };

exports.getAvailableRooms = async (req, res) => {
  const [rooms] = await db.query(
    `SELECT b.*
FROM bingo_rooms b
JOIN (
    SELECT entry_fee, MIN(id) AS min_id
    FROM bingo_rooms
    WHERE status IN ('waiting', 'countdown', 'started')
    GROUP BY entry_fee
) x
ON b.id = x.min_id
ORDER BY b.entry_fee ASC;


`
  );
  res.json(rooms);
};

//start countdown when userclik confirm and joins button

// controller/bingocontroller.js
// controller/bingocontroller.js
const countdownIntervals = {};

exports.startCountdown = async (req, res) => {
  try {
    const { room_id, seconds = 60 } = req.body;

    const [[room]] = await db.query(
      "SELECT status FROM bingo_rooms WHERE id=?",
      [room_id],
    );
    if (!room) return res.status(404).json({ msg: "Room not found" });
    if (room.status === "countdown" || room.status === "started") {
      return res.json({ success: false, msg: "Countdown already started" });
    }

    await db.query("UPDATE bingo_rooms SET status='countdown' WHERE id=?", [
      room_id,
    ]);

    const io = req.io;
    io.to(`room_${room_id}`).emit("countdown_started", { seconds });

    let secondsLeft = seconds;

    // Create interval and store with restarted = false
    const intervalId = setInterval(async () => {
      secondsLeft--;
      io.to(`room_${room_id}`).emit("countdown_tick", secondsLeft);

      // Update memory
      if (countdownIntervals[room_id]) {
        countdownIntervals[room_id].secondsLeft = secondsLeft;
      }

      if (secondsLeft <= 0) {
        clearInterval(intervalId);
        const countdownData = countdownIntervals[room_id]; // get stored data (includes restarted flag)
        delete countdownIntervals[room_id];

        // ------------------------------------------------------------
        // ✅ Check number of confirmed players (prize > 0)
        // ------------------------------------------------------------
        const [[{ count: confirmedCount }]] = await db.query(
          "SELECT COUNT(DISTINCT user_id) AS count FROM bingo_players WHERE room_id = ? AND prize > 0",
          [room_id],
        );

        if (confirmedCount >= 2) {
          // Enough players – start the game
          await db.query(
            "UPDATE bingo_rooms SET status='started', started_at=COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id=?",
            [room_id],
          );

          io.to(`room_${room_id}`).emit("countdown_finished", { room_id });

          const engine = require("../socket/engine");
          engine.startGameEngine(io, room_id).catch(console.error);
        } else {
          // Not enough players – decide whether to restart or cancel
          if (!countdownData?.restarted) {
            // First failure – restart countdown once
            io.to(`room_${room_id}`).emit("countdown_restarting", {
              reason: "Not enough players. Restarting countdown...",
            });

            // Restart countdown with original seconds
            const newSeconds = seconds; // or use a fixed value like 60
            await db.query(
              "UPDATE bingo_rooms SET status='countdown' WHERE id=?",
              [room_id],
            );

            io.to(`room_${room_id}`).emit("countdown_started", {
              seconds: newSeconds,
            });

            let newSecondsLeft = newSeconds;
            const newIntervalId = setInterval(async () => {
              newSecondsLeft--;
              io.to(`room_${room_id}`).emit("countdown_tick", newSecondsLeft);

              if (newSecondsLeft <= 0) {
                clearInterval(newIntervalId);
                delete countdownIntervals[room_id];

                // Check player count again
                const [[{ count: finalCount }]] = await db.query(
                  "SELECT COUNT(DISTINCT user_id) AS count FROM bingo_players WHERE room_id = ? AND prize > 0",
                  [room_id],
                );

                if (finalCount >= 2) {
                  // Enough players now – start game
                  await db.query(
                    "UPDATE bingo_rooms SET status='started', started_at=COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id=?",
                    [room_id],
                  );
                  io.to(`room_${room_id}`).emit("countdown_finished", {
                    room_id,
                  });

                  const engine = require("../socket/engine");
                  engine.startGameEngine(io, room_id).catch(console.error);
                } else {
                  // Still not enough – cancel permanently
                  await db.query(
                    "UPDATE bingo_rooms SET status='waiting' WHERE id=?",
                    [room_id],
                  );

                  // Refund entry fee to each confirmed player
                  await db.query(
                    `UPDATE users u
                     JOIN (
                       SELECT user_id, COUNT(*) AS card_count
                       FROM bingo_players
                       WHERE room_id = ? AND prize > 0
                       GROUP BY user_id
                     ) confirmed ON confirmed.user_id = u.id
                     JOIN bingo_rooms r ON r.id = ?
                     SET u.main_balance = u.main_balance + r.entry_fee * confirmed.card_count`,
                    [room_id, room_id],
                  );

                  // Reset prizes to 0
                  await db.query(
                    "UPDATE bingo_players SET prize = 0 WHERE room_id = ?",
                    [room_id],
                  );

                  io.to(`room_${room_id}`).emit("countdown_cancelled", {
                    reason:
                      "Not enough players(only You.Back to home and Try again.",
                  });
                }
              }
            }, 1000);

            // Store new interval with restarted = true
            countdownIntervals[room_id] = {
              intervalId: newIntervalId,
              secondsLeft: newSeconds,
              restarted: true,
            };
          } else {
            // Already restarted once – cancel permanently
            await db.query(
              "UPDATE bingo_rooms SET status='waiting' WHERE id=?",
              [room_id],
            );

            // Refund confirmed players
            await db.query(
              `UPDATE users u
               JOIN (
                 SELECT user_id, COUNT(*) AS card_count
                 FROM bingo_players
                 WHERE room_id = ? AND prize > 0
                 GROUP BY user_id
               ) confirmed ON confirmed.user_id = u.id
               JOIN bingo_rooms r ON r.id = ?
               SET u.main_balance = u.main_balance + r.entry_fee * confirmed.card_count`,
              [room_id, room_id],
            );

            await db.query(
              "UPDATE bingo_players SET prize = 0 WHERE room_id = ?",
              [room_id],
            );

            io.to(`room_${room_id}`).emit("countdown_cancelled", {
              reason: "Not enough players. Game cancelled.",
            });
          }
        }
      }
    }, 1000);

    // Store interval + secondsLeft + restarted flag
    countdownIntervals[room_id] = { intervalId, secondsLeft, restarted: false };

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};


// ------------------- NEW API -------------------
// GET /bingo/current-countdown/:room_id
exports.getCurrentCountdown = (req, res) => {
  const { room_id } = req.params;
  const countdown = countdownIntervals[room_id];

  if (!countdown) return res.json({ status: "waiting", seconds: 0 });

  return res.json({ status: "countdown", seconds: countdown.secondsLeft });
};




// ------------------------------------------------------
// JOIN ROOM
// ------------------------------------------------------
exports.joinRoom = async (req, res) => {
  const user_id = req.user.id;
  const { room_id } = req.body;

  await db.query(
    `INSERT INTO bingo_players (room_id, user_id)
     SELECT ?, ? FROM DUAL
     WHERE NOT EXISTS (
       SELECT 1 FROM bingo_players WHERE room_id=? AND user_id=?
     )`,
    [room_id, user_id, room_id, user_id]
  );

  res.json({ message: "Joined" });
};

// ------------------------------------------------------
// SELECT CARD
// ------------------------------------------------------
// exports.selectCard = async (req, res) => {
//   const user_id = req.user.id;
//   const { room_id } = req.body;

//   const card = generateBingoCard();

//   await db.query(
//     "UPDATE bingo_players SET card=?, marked=? WHERE room_id=? AND user_id=?",
//     [JSON.stringify(card), "[]", room_id, user_id]
//   );

//   res.json({ card });
// };

// it comments after 1-150
// exports.selectCard = async (req, res) => {
//   const user_id = req.user.id;
//   const { room_id } = req.body;

//   try {
//     // Check if this line is the failure point
//     const card = generateBingoCard();

//     // Check if this line is the failure point
//     await db.query(
//       "UPDATE bingo_players SET card=?, marked=? WHERE room_id=? AND user_id=?",
//       [JSON.stringify(card), "[]", room_id, user_id]
//     );

//     res.json({ card });
//   } catch (error) {
//     // THIS WILL PRINT THE ERROR TO YOUR SERVER CONSOLE
//     console.error("Error in selectCard:", error);

//     // Send the error message back to the client for temporary debugging
//     res
//       .status(500)
//       .json({
//         message: "Server Error during card selection",
//         error: error.message,
//       });
//   }
// };

// exports.selectCard = async (req, res) => {
//   const user_id = req.user.id;
//   const { room_id, card_number } = req.body; // <-- IMPORTANT

//   if (!card_number)
//     return res.status(400).json({ message: "Card number is required" });

//   try {
//     // 1. Fetch fixed card from DB
//     const [rows] = await db.query("SELECT card FROM fixed_cards WHERE id = ?", [
//       card_number,
//     ]);

//     if (rows.length === 0)
//       return res.status(404).json({ message: "Card not found" });

//     const fixedCard = JSON.parse(rows[0].card);

//     // 2. Update bingo_players with selected card
//     await db.query(
//       "UPDATE bingo_players SET card=?, marked=? WHERE room_id=? AND user_id=?",
//       [JSON.stringify(fixedCard), "[]", room_id, user_id]
//     );

//     res.json({ card: fixedCard });
//   } catch (error) {
//     console.error("selectCard error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

//for alrady token
exports.selectCard = async (req, res) => {
  const user_id = req.user.id;
  const { room_id, card_number } = req.body;

  if (!card_number)
    return res.status(400).json({ message: "Card number is required" });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[room]] = await connection.query(
      "SELECT status FROM bingo_rooms WHERE id = ? FOR UPDATE",
      [room_id],
    );
    const reject = async (status, message) => {
      await connection.rollback();
      return res.status(status).json({ message });
    };

    if (!room) return await reject(404, "Room not found");
    if (room.status !== "waiting" && room.status !== "countdown") {
      return await reject(400, "Room is no longer accepting cards.");
    }

    const [playerRows] = await connection.query(
      "SELECT id, selected_number, prize FROM bingo_players WHERE room_id = ? AND user_id = ? ORDER BY id",
      [room_id, user_id],
    );
    const selectedCards = playerRows.filter(
      (player) => player.selected_number !== null,
    );
    const confirmedCards = selectedCards.filter(
      (player) => Number(player.prize) > 0,
    );
    const pendingCard = selectedCards.find(
      (player) => Number(player.prize) <= 0,
    );
    if (confirmedCards.length >= 2 || (selectedCards.length >= 2 && !pendingCard)) {
      return await reject(400, "Maximum 2 cards per round.");
    }

    const [taken] = await connection.query(
      "SELECT user_id, prize FROM bingo_players WHERE room_id = ? AND selected_number = ?",
      [room_id, card_number],
    );
    const takenByAnotherPlayerOrConfirmed = taken.some(
      (player) =>
        String(player.user_id) !== String(user_id) ||
        Number(player.prize) > 0,
    );
    if (takenByAnotherPlayerOrConfirmed) {
      return await reject(400, "Card number already taken!");
    }

    const [rows] = await connection.query(
      "SELECT card FROM fixed_cards WHERE id = ?",
      [card_number],
    );
    if (rows.length === 0)
      return await reject(404, "Card not found");

    const fixedCard = JSON.parse(rows[0].card);
    const rowToUpdate =
      pendingCard ||
      playerRows.find((player) => player.selected_number === null);
    if (rowToUpdate) {
      await connection.query(
        `UPDATE bingo_players
         SET card = ?, marked = ?, selected_number = ?
         WHERE id = ?`,
        [JSON.stringify(fixedCard), "[]", card_number, rowToUpdate.id],
      );
    } else {
      await connection.query(
        `INSERT INTO bingo_players (room_id, user_id, card, marked, selected_number)
         VALUES (?, ?, ?, ?, ?)`,
        [room_id, user_id, JSON.stringify(fixedCard), "[]", card_number],
      );
    }

    await connection.commit();
    if (req.io) {
      req.io.to(`room_${room_id}`).emit("player_selected_card");
    }
    res.json({ card: fixedCard });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("selectCard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) connection.release();
  }
};


// In bingoController.js – updated confirmCard

exports.confirmCard = async (req, res) => {
  const user_id = req.user.id;
  const { room_id, card_number } = req.body;

  let connection;
  let prize;
  let newConfirmedCount;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const reject = async (status, message) => {
      await connection.rollback();
      return res.status(status).json({ message });
    };

    const [[room]] = await connection.query(
      "SELECT status, entry_fee FROM bingo_rooms WHERE id=? FOR UPDATE",
      [room_id],
    );
    if (!room) return await reject(404, "Room not found");
    if (room.status !== "waiting" && room.status !== "countdown") {
      return await reject(
        400,
        "Cannot confirm now. Room is not open for joining.",
      );
    }

    const [selectedCards] = await connection.query(
      "SELECT id, prize, selected_number FROM bingo_players WHERE room_id=? AND user_id=? AND selected_number IS NOT NULL FOR UPDATE",
      [room_id, user_id],
    );
    if (selectedCards.length === 0) {
      return await reject(400, "Select at least one card first.");
    }
    if (selectedCards.length > 2) {
      return await reject(400, "Maximum 2 cards per round.");
    }

    let players;
    if (card_number !== undefined && card_number !== null) {
      const card = selectedCards.find(
        (player) => String(player.selected_number) === String(card_number),
      );
      if (!card) {
        return await reject(400, "Card is not selected for this room.");
      }
      if (Number(card.prize) > 0) {
        return await reject(400, "Already confirmed");
      }
      players = [card];
    } else {
      players = selectedCards.filter((player) => Number(player.prize) <= 0);
      if (players.length === 0) {
        return await reject(400, "Already confirmed");
      }
    }

    const [[user]] = await connection.query(
      "SELECT main_balance FROM users WHERE id=? FOR UPDATE",
      [user_id],
    );
    if (!user) return await reject(404, "User not found");

    const main_balance = Number(user.main_balance);
    const entry_fee = Number(room.entry_fee);
    const purchaseTotal = entry_fee * players.length;
    if (main_balance < purchaseTotal) {
      return await reject(400, "Insufficient balance");
    }

    await connection.query(
      "UPDATE users SET main_balance = main_balance - ? WHERE id=?",
      [purchaseTotal, user_id],
    );

    const [[{ count: playersCount }]] = await connection.query(
      "SELECT COUNT(*) AS count FROM bingo_players WHERE room_id=? AND prize > 0",
      [room_id],
    );

    const totalPool = entry_fee * (Number(playersCount) + players.length);
    const platformFee = totalPool * 0.2;
    prize = totalPool - platformFee;

    await connection.query(
      "UPDATE bingo_players SET prize=? WHERE id IN (?)",
      [prize, players.map((player) => player.id)],
    );

    const [[{ count }]] = await connection.query(
      "SELECT COUNT(*) AS count FROM bingo_players WHERE room_id=? AND prize > 0",
      [room_id],
    );
    newConfirmedCount = Number(count);

    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("confirmCard error:", error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }

  // 8. Emit prize update to the room
  if (req.io) {
    req.io.to(`room_${room_id}`).emit(`room_${room_id}_prize_update`, prize);
  }

  // 9. Emit updated confirmed player count
  if (req.io) {
    req.io.to(`room_${room_id}`).emit("confirmed_player_count", newConfirmedCount);
  }

  res.json({ message: "Confirmed", prize });
};


//prize


// ---------------------------
// Get confirmed prize for a room
exports.getPrize = async (req, res) => {
  const { roomId } = req.params;

  try {
    const [rows] = await db.query(
      "SELECT prize FROM bingo_players WHERE room_id = ? AND prize IS NOT NULL AND prize > 0 LIMIT 1",
      [roomId]
    );

    if (!rows || rows.length === 0) {
      return res.json({ prize: 0 });
    }

    const prize = Number(rows[0].prize) || 0;
    return res.json({ prize });
  } catch (err) {
    console.error("getPrize error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};





exports.getTakenNumbers = async (req, res) => {
  const { room_id } = req.params;

  try {
    const [rows] = await db.query(
      "SELECT selected_number FROM bingo_players WHERE room_id = ? AND selected_number IS NOT NULL",
      [room_id]
    );

    const taken = rows.map((r) => r.selected_number);

    res.json({ taken });
  } catch (error) {
    console.error("getTakenNumbers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// ------------------------------------------------------
// GET ROOM STATE
// ------------------------------------------------------
// exports.getRoomState = async (req, res) => {
//   const { room_id } = req.query;

//   const [[room]] = await db.query("SELECT * FROM bingo_rooms WHERE id=?", [
//     room_id,
//   ]);
//   const [players] = await db.query(
//     "SELECT user_id, card, is_winner FROM bingo_players WHERE room_id=?",
//     [room_id]
//   );

//   res.json({ room, players });
// };


// Optional: get room state
exports.getRoomState = async (req, res) => {
  const { room_id } = req.query;

  const [[room]] = await db.query(
    "SELECT * FROM bingo_rooms WHERE id=?",
    [room_id]
  );

  const [players] = await db.query(
    "SELECT user_id, card, selected_number, is_winner, prize FROM bingo_players WHERE room_id=?",
    [room_id]
  );

  res.json({ room, players });
};

exports.getRoomHistory = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         r.id AS room_id,
         r.room_name,
         r.status,
         r.entry_fee,
         r.started_at,
         r.ended_at,
         COALESCE(payout.total_pool, player_totals.player_count * r.entry_fee, 0) AS total,
         COALESCE(payout.platform_fee, player_totals.player_count * r.entry_fee * 0.2, 0) AS fee,
         COALESCE(payout.prize_amount, player_totals.current_prize, 0) AS prize,
         bp.id AS player_id,
         u.username AS player_name,
         bp.selected_number AS card_number,
         bp.prize > 0 AS confirmed,
         bp.is_winner
       FROM bingo_rooms r
       LEFT JOIN bingo_players bp ON bp.room_id = r.id
       LEFT JOIN users u ON u.id = bp.user_id
       LEFT JOIN (
         SELECT room_id, COUNT(*) AS player_count, MAX(prize) AS current_prize
         FROM bingo_players
         WHERE prize > 0
         GROUP BY room_id
       ) player_totals ON player_totals.room_id = r.id
       LEFT JOIN (
         SELECT
           room_id,
           MAX(total_pool) AS total_pool,
           MAX(platform_fee) AS platform_fee,
           MAX(prize_amount) AS prize_amount
         FROM bingo_payouts
         GROUP BY room_id
       ) payout ON payout.room_id = r.id
       WHERE r.status = 'finished'
       ORDER BY r.ended_at DESC, r.id DESC, bp.id ASC`,
    );

    const rooms = new Map();
    for (const row of rows) {
      if (!rooms.has(row.room_id)) {
        rooms.set(row.room_id, {
          room_id: row.room_id,
          room_name: row.room_name,
          status: row.status,
          entry_fee: row.entry_fee,
          total: row.total,
          fee: row.fee,
          prize: row.prize,
          started_at: row.started_at,
          ended_at: row.ended_at,
          players: [],
          winner_name: null,
        });
      }

      const room = rooms.get(row.room_id);
      if (row.player_id) {
        room.players.push({
          name: row.player_name,
          card_number: row.card_number,
          confirmed: Number(row.confirmed) === 1,
        });
        if (Number(row.is_winner) === 1) room.winner_name = row.player_name;
      }
    }

    res.json(Array.from(rooms.values()));
  } catch (error) {
    console.error("getRoomHistory error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMyActiveGame = async (req, res) => {
  try {
    const [[room]] = await db.query(
      `SELECT r.id
       FROM bingo_rooms r
       JOIN bingo_players bp ON bp.room_id = r.id
       WHERE bp.user_id = ? AND bp.prize > 0 AND r.status = 'started'
       ORDER BY r.id DESC
       LIMIT 1`,
      [req.user.id]
    );

    res.json({ room_id: room?.id ?? null });
  } catch (error) {
    console.error("getMyActiveGame error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------------------------------------------
// CLAIM BINGO
// ------------------------------------------------------
exports.claimBingo = async (req, res) => {
  const user_id = req.user.id;
  const { room_id } = req.body;

  const [players] = await db.query(
    "SELECT id, card FROM bingo_players WHERE room_id=? AND user_id=? AND prize > 0",
    [room_id, user_id]
  );

  if (players.length === 0)
    return res.status(404).json({ message: "Player not found" });

  const winningPlayer = players.find((player) => {
    if (!player.card) return false;
    const card =
      typeof player.card === "string" ? JSON.parse(player.card) : player.card;
    return require("../utils/checkWinner").checkBingoWinner(card);
  });

  const isWinner = Boolean(winningPlayer);

  await db.query(
    `INSERT INTO bingo_claims (room_id, player_id, user_id, is_validated, validation_msg)
     VALUES (?, ?, ?, ?, ?)`,
    [
      room_id,
      (winningPlayer || players[0]).id,
      user_id,
      isWinner ? 1 : 0,
      isWinner ? "WIN" : "INVALID",
    ]
  );

  res.json({
    message: isWinner ? " You WON The Game!" : "Invalid Bingo",
  });
};
