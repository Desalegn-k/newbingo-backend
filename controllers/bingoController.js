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
    "SELECT * FROM bingo_rooms WHERE status IN ('waiting', 'countdown')"
  );
  res.json(rooms);
};

//start countdown when userclik confirm and joins button

// controller/bingocontroller.js
// controller/bingocontroller.js
const countdownIntervals = {};

exports.startCountdown = async (req, res) => {
  try {
    const { room_id, seconds = 20} = req.body;

    // DB check
    const [[room]] = await db.query(
      "SELECT status FROM bingo_rooms WHERE id=?",
      [room_id]
    );
    if (!room) return res.status(404).json({ msg: "Room not found" });
    if (room.status === "countdown" || room.status === "started") {
      return res.json({ success: false, msg: "Countdown already started" });
    }

    // Set countdown status in DB
    await db.query("UPDATE bingo_rooms SET status='countdown' WHERE id=?", [room_id]);

    const io = req.io;
    io.to(`room_${room_id}`).emit("countdown_started", { seconds });

    let secondsLeft = seconds;

    const intervalId = setInterval(async () => {
      secondsLeft--;
      io.to(`room_${room_id}`).emit("countdown_tick", secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(intervalId);
        delete countdownIntervals[room_id];

        // ✅ Change status to started
        await db.query("UPDATE bingo_rooms SET status='started' WHERE id=?", [room_id]);

        io.to(`room_${room_id}`).emit("countdown_finished", { room_id });

        // ✅ Start the engine AFTER countdown finished
        const engine = require("../socket/engine");
        engine.startGameEngine(io, room_id).catch(console.error);
      }
    }, 1000);

    countdownIntervals[room_id] = intervalId;

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
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

  try {
    // 1️⃣ Check if the card number is already taken by another player
    const [taken] = await db.query(
      "SELECT user_id FROM bingo_players WHERE room_id = ? AND selected_number = ?",
      [room_id, card_number]
    );

    if (taken.length > 0) {
      return res.status(400).json({ message: "Card number already taken!" });
    }

    // 2️⃣ Fetch fixed card from DB
    const [rows] = await db.query("SELECT card FROM fixed_cards WHERE id = ?", [
      card_number,
    ]);

    if (rows.length === 0)
      return res.status(404).json({ message: "Card not found" });

    const fixedCard = JSON.parse(rows[0].card);

    // 3️⃣ Update player's selected card and store selected_number
    await db.query(
      `UPDATE bingo_players 
       SET card = ?, marked = ?, selected_number = ? 
       WHERE room_id = ? AND user_id = ?`,
      [JSON.stringify(fixedCard), "[]", card_number, room_id, user_id]
    );

    res.json({ card: fixedCard });
  } catch (error) {
    console.error("selectCard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ------------------------------------------------------
// CONFIRM CARD + START COUNTDOWN
// ------------------------------------------------------
exports.confirmCard = async (req, res) => {
  const user_id = req.user.id;
  const { room_id } = req.body;

  const [[room]] = await db.query(
    "SELECT entry_fee FROM bingo_rooms WHERE id=?",
    [room_id]
  );
  const [[user]] = await db.query("SELECT main_balance FROM users WHERE id=?", [
    user_id,
  ]);

  const main_balance = Number(user.main_balance);
  const entry_fee = Number(room.entry_fee);

  if (!room || main_balance < entry_fee) {
    return res.status(400).json({ message: "Insufficient balancennn" });
  }
  
 

  await db.query(
    "UPDATE users SET main_balance = main_balance - ? WHERE id=?",
    [room.entry_fee, user_id]
  );

  // Switch to countdown
  // await db.query("UPDATE bingo_rooms SET status='countdown' WHERE id=?", [
  //   room_id,
  // ]);

  // Notify all players
  req.io.to(`room_${room_id}`).emit("countdown_started", { room_id });

  // Start engine
  engine.startGameEngine(req.io, room_id);

  res.json({ message: "Confirmed" });
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
exports.getRoomState = async (req, res) => {
  const { room_id } = req.query;

  const [[room]] = await db.query("SELECT * FROM bingo_rooms WHERE id=?", [
    room_id,
  ]);
  const [players] = await db.query(
    "SELECT user_id, card, is_winner FROM bingo_players WHERE room_id=?",
    [room_id]
  );

  res.json({ room, players });
};

// ------------------------------------------------------
// CLAIM BINGO
// ------------------------------------------------------
exports.claimBingo = async (req, res) => {
  const user_id = req.user.id;
  const { room_id } = req.body;

  const [[player]] = await db.query(
    "SELECT id, card, marked FROM bingo_players WHERE room_id=? AND user_id=?",
    [room_id, user_id]
  );

  if (!player) return res.status(404).json({ message: "Player not found" });

  const card = JSON.parse(player.card);

  const isWinner = require("../utils/checkWinner").checkBingoWinner(card);

  await db.query(
    `INSERT INTO bingo_claims (room_id, player_id, user_id, is_validated, validation_msg)
     VALUES (?, ?, ?, ?, ?)`,
    [
      room_id,
      player.id,
      user_id,
      isWinner ? 1 : 0,
      isWinner ? "WIN" : "INVALID",
    ]
  );

  res.json({
    message: isWinner ? "Valid Bingo!" : "Invalid Bingo",
  });
};
