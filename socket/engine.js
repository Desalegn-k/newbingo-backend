// server/socket/engine.js
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
      `[startGameEngine] Room ${room_id} not ready, status=${room?.status}`
    );
    return; // Do not start yet
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

  // // ✅ Update room status to started
  // await db.query("UPDATE bingo_rooms SET status='started' WHERE id=?", [
  //   room_id,
  // ]);

  // Notify clients that game started (they should already be on /game)
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

    // Update players' cards in DB
    const [players] = await db.query(
      "SELECT id, user_id, card FROM bingo_players WHERE room_id=?",
      [room_id]
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
      // if (checkBingoWinner(card)) {
      //   await db.query("UPDATE bingo_players SET is_winner=1 WHERE id=?", [
      //     p.id,
      //   ]);
      //   io.to(`room_${room_id}`).emit("winner_declared", {
      //     user_id: p.user_id,
      //   });

      //   // End game immediately if there's a winner
      //   await endGame(io, room_id);
      //   return;
      // }

      if (checkBingoWinner(card)) {
        try {
          // 1) fetch entry fee of the room
          const [[roomInfo]] = await db.query(
            "SELECT entry_fee FROM bingo_rooms WHERE id = ?",
            [room_id]
          );

          const entryFee = Number(roomInfo.entry_fee);

          // 2) count joined players
          const [[countRow]] = await db.query(
            "SELECT COUNT(*) AS cnt FROM bingo_players WHERE room_id = ?",
            [room_id]
          );

          const playersCount = Number(countRow.cnt);

          // 3) calculate pool and prize
          const totalPool = entryFee * playersCount;
          const platformFee = totalPool * 0.2;
          const prize = totalPool - platformFee;

          // 4) database transaction for safety
          const conn = await db.getConnection();

          try {
            await conn.beginTransaction();

            // mark winner
            await conn.query(
              "UPDATE bingo_players SET is_winner=1 WHERE id=?",
              [p.id]
            );

            // update balance of winner
            await conn.query(
              "UPDATE users SET main_balance = main_balance + ? WHERE id = ?",
              [prize, p.user_id]
            );

            // insert payout logs
            await conn.query(
              "INSERT INTO bingo_payouts (room_id, winner_user_id, total_pool, platform_fee, prize_amount) VALUES (?,?,?,?,?)",
              [room_id, p.user_id, totalPool, platformFee, prize]
            );

            await conn.commit();
          } catch (err) {
            await conn.rollback();
            throw err;
          } finally {
            conn.release();
          }

          // 5) notify players
          //  const [[user]] = await conn.query(
          //    "SELECT username FROM users WHERE id = ?",
          //    [p.user_id]
          //  );

          // io.to(`room_${room_id}`).emit("winner_declared", {

          //   user_id: p.user_id,
          //   username: user.username,
          //   prize: prize,
          //   total_pool: totalPool,
          //   platform_fee: platformFee,

          // });

          // Get username and selected_number in one query
          const [[winnerInfo]] = await conn.query(
            `SELECT u.username, bp.selected_number
   FROM bingo_players bp
   JOIN users u ON bp.user_id = u.id
   WHERE bp.id = ?`,
            [p.id] // Use p.id (player row ID)
          );

          io.to(`room_${room_id}`).emit("winner_declared", {
            user_id: p.user_id,
            username: winnerInfo.username,
            prize: prize,
            total_pool: totalPool,
            platform_fee: platformFee,
            user_selected_number: winnerInfo.selected_number,
          });

          // 6) end game after awarding
          await endGame(io, room_id);
          return;
        } catch (err) {
          console.error("PAYOUT ERROR:", err);
        }
      }

    }

    // Schedule next draw after 3 seconds
    game.timer = setTimeout(drawNumber, 3000);
  }, 1000); // 1-second initial delay
};

// End game
// async function endGame(io, room_id) {
//   if (!activeGames[room_id]) return;

//   clearTimeout(activeGames[room_id].timer);
//   delete activeGames[room_id];

//   // Update status to finished
//   await db.query("UPDATE bingo_rooms SET status='finished' WHERE id=?", [
//     room_id,
//   ]);

//   io.to(`room_${room_id}`).emit("game_finished", { room_id });
// }

// =======================
//  END GAME FUNCTION
// =======================
// async function endGame(io, room_id) {
//   if (!activeGames[room_id]) return;

//   clearTimeout(activeGames[room_id].timer);
//   delete activeGames[room_id];

//   // -------------------------------------------
//   // 1. Get winner
//   // -------------------------------------------
//   const [[winner]] = await db.query(
//     "SELECT * FROM bingo_players WHERE room_id=? AND is_winner=1 LIMIT 1",
//     [room_id]
//   );

//   if (!winner) {
//     // no winner? just close room normally
//     await db.query("UPDATE bingo_rooms SET status='finished' WHERE id=?", [
//       room_id,
//     ]);

//     io.to(`room_${room_id}`).emit("game_finished", { room_id });
//     return;
//   }

//   // -------------------------------------------
//   // 2. Get entry fee from room
//   // -------------------------------------------
//   const [[room]] = await db.query(
//     "SELECT entry_fee FROM bingo_rooms WHERE id=?",
//     [room_id]
//   );

//   const entryFee = room.entry_fee;

//   // -------------------------------------------
//   // 3. Count how many players joined
//   // -------------------------------------------
//   const [[playerCount]] = await db.query(
//     "SELECT COUNT(*) AS total FROM bingo_players WHERE room_id=?",
//     [room_id]
//   );

//   const totalPlayers = playerCount.total;

//   // -------------------------------------------
//   // 4. Prize calculation
//   // -------------------------------------------
//   const totalPool = totalPlayers * entryFee;
//   const houseCut = totalPool * 0.20; // 20%
//   const prize = totalPool - houseCut; // amount winner gets

//   // -------------------------------------------
//   // 5. Increase winner's main balance
//   // -------------------------------------------
//   await db.query(
//     "UPDATE users SET main_balance = main_balance + ? WHERE id=?",
//     [prize, winner.user_id]
//   );

//   // -------------------------------------------
//   // 6. Insert into bingo_payouts table
//   // -------------------------------------------
//   await db.query(
//     `INSERT INTO bingo_payouts (room_id, user_id, total_pool, house_cut, prize_amount) 
//      VALUES (?, ?, ?, ?, ?)`,
//     [room_id, winner.user_id, totalPool, houseCut, prize]
//   );

//   // -------------------------------------------
//   // 7. Update room to finished
//   // -------------------------------------------
//   await db.query("UPDATE bingo_rooms SET status='finished' WHERE id=?", [
//     room_id,
//   ]);

//   // -------------------------------------------
//   // 8. Emit to all players
//   // -------------------------------------------
//   io.to(`room_${room_id}`).emit("winner_declared", {
//     user_id: winner.user_id,
//     prize,
//     total_pool: totalPool,
//   });

//   io.to(`room_${room_id}`).emit("game_finished", { room_id });
// }
// =======================
//  CLEAN END GAME FUNCTION
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
