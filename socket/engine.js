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
      if (checkBingoWinner(card)) {
        await db.query("UPDATE bingo_players SET is_winner=1 WHERE id=?", [
          p.id,
        ]);
        io.to(`room_${room_id}`).emit("winner_declared", {
          user_id: p.user_id,
        });

        // End game immediately if there's a winner
        await endGame(io, room_id);
        return;
      }
    }

    // Schedule next draw after 3 seconds
    game.timer = setTimeout(drawNumber, 3000);
  }, 1000); // 1-second initial delay
};

// End game
async function endGame(io, room_id) {
  if (!activeGames[room_id]) return;

  clearTimeout(activeGames[room_id].timer);
  delete activeGames[room_id];

  // Update status to finished
  await db.query("UPDATE bingo_rooms SET status='finished' WHERE id=?", [
    room_id,
  ]);

  io.to(`room_${room_id}`).emit("game_finished", { room_id });
}

// Optional helper to schedule room start
exports.scheduleRoomStart = (io, room_id, start_time) => {
  const now = Date.now();
  const start = new Date(start_time).getTime();
  const diff = Math.max(0, start - now);
  setTimeout(() => exports.startGameEngine(io, room_id), diff);
};
