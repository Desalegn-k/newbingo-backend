const db = require("../config/db");
const { generateDrawSequence } = require("../utils/randomDraw");
const { markNumberOnCard } = require("../utils/markNumber");
const { checkBingoWinner } = require("../utils/checkWinner");

let activeGames = {}; // room_id => { drawIndex, sequence, timer }

exports.startGameEngine = async (io, room_id) => {
  const [[room]] = await db.query("SELECT status FROM bingo_rooms WHERE id=?", [
    room_id,
  ]);

  if (!room || room.status !== "started") {
    console.log(
      `[startGameEngine] Room ${room_id} not ready, status=${room?.status}`,
    );
    return;
  }
  if (activeGames[room_id]) return; // game already running

  // Initialize game state
  const sequence = generateDrawSequence();
  activeGames[room_id] = {
    drawIndex: 0,
    sequence,
    timer: null,
  };
  const game = activeGames[room_id];

  // Notify clients that game started
  io.to(`room_${room_id}`).emit("game_started", { room_id });

  // ✅ Delay first draw slightly to ensure clients are ready
  game.timer = setTimeout(async function drawNumber() {
    if (!activeGames[room_id]) return;

    // If all numbers drawn, end game
    if (game.drawIndex >= game.sequence.length) {
      await endGame(io, room_id);
      return;
    }

    const number = game.sequence[game.drawIndex++];
    io.to(`room_${room_id}`).emit("number_drawn", number);

    // ✅ Only fetch confirmed players (prize > 0)
    const [players] = await db.query(
      "SELECT id, user_id, card, selected_number FROM bingo_players WHERE room_id=? AND prize > 0",
      [room_id],
    );

    for (let p of players) {
      if (!p.card) continue;

      let card = JSON.parse(p.card);
      card = markNumberOnCard(card, number);

      await db.query("UPDATE bingo_players SET card=? WHERE id=?", [
        JSON.stringify(card),
        p.id,
      ]);

      // Emit updated card to client
      io.to(`room_${room_id}`).emit("card_updated", {
        user_id: p.user_id,
        card,
      });

      // Check if this player wins
      if (checkBingoWinner(card)) {
        try {
          // 1) Fetch entry fee
          const [[roomInfo]] = await db.query(
            "SELECT entry_fee FROM bingo_rooms WHERE id = ?",
            [room_id],
          );
          const entryFee = Number(roomInfo.entry_fee);

          // 2) Count confirmed players only for prize pool
          const [[countRow]] = await db.query(
            "SELECT COUNT(*) AS cnt FROM bingo_players WHERE room_id = ? AND prize > 0",
            [room_id],
          );
          const playersCount = Number(countRow.cnt);

          // 3) Calculate pool and prize
          const totalPool = entryFee * playersCount;
          const platformFee = totalPool * 0.2;
          const prize = totalPool - platformFee;

          // 4) Transaction for safety
          const conn = await db.getConnection();
          try {
            await conn.beginTransaction();

            // mark winner
            await conn.query(
              "UPDATE bingo_players SET is_winner=1 WHERE id=?",
              [p.id],
            );

            // update balance of winner
            await conn.query(
              "UPDATE users SET main_balance = main_balance + ? WHERE id = ?",
              [prize, p.user_id],
            );

            // insert payout logs
            await conn.query(
              "INSERT INTO bingo_payouts (room_id, winner_user_id, total_pool, platform_fee, prize_amount) VALUES (?,?,?,?,?)",
              [room_id, p.user_id, totalPool, platformFee, prize],
            );

            await conn.commit();
          } catch (err) {
            await conn.rollback();
            throw err;
          } finally {
            conn.release();
          }

          // 5) Get winner info (username, selected_number) and include the card
          const [[winnerInfo]] = await db.query(
            `SELECT u.username, bp.selected_number
             FROM bingo_players bp
             JOIN users u ON bp.user_id = u.id
             WHERE bp.id = ?`,
            [p.id],
          );

          io.to(`room_${room_id}`).emit("winner_declared", {
            user_id: p.user_id,
            username: winnerInfo.username,
            prize: prize,
            total_pool: totalPool,
            platform_fee: platformFee,
            user_selected_number: winnerInfo.selected_number,
            card: card, // <-- include winner's card
          });

          // 6) End game after awarding
          await endGame(io, room_id);
          return;
        } catch (err) {
          console.error("PAYOUT ERROR:", err);
        }
      }
    }

    // Schedule next draw after 3 seconds
    game.timer = setTimeout(drawNumber, 3000);
  }, 1000);
};

// =======================
//  END GAME FUNCTION
// =======================
async function endGame(io, room_id) {
  if (!activeGames[room_id]) return;

  // Stop the countdown timer
  clearTimeout(activeGames[room_id].timer);
  delete activeGames[room_id];

  // Mark room as finished in the database
  await db.query("UPDATE bingo_rooms SET status='finished' WHERE id = ?", [
    room_id,
  ]);

  // Notify all players in the room that the game has finished
  io.to(`room_${room_id}`).emit(`room_${room_id}_finished`);

  console.log(`Room ${room_id} finished. Clients notified.`);
}

// Optional helper to schedule room start
exports.scheduleRoomStart = (io, room_id, start_time) => {
  const now = Date.now();
  const start = new Date(start_time).getTime();
  const diff = Math.max(0, start - now);
  setTimeout(() => exports.startGameEngine(io, room_id), diff);
};
