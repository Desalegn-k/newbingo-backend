const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const userRoutes = require("./routes/userRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const depositRoutes = require("./routes/depositRoutes");
 const bingoRoutes=require("./routes/bingoRouts")
 

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*" } });
// make io available to controllers via req.io

app.use((req, res, next) => {
  req.io = io;
  next();
});


app.use(express.json());
app.use(cors());

 

// Routes
app.use("/api/auth", userRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/deposit", depositRoutes);
app.use("/api/bingo", bingoRoutes);

// socket connection and simple handlers
io.on("connection", (socket) => {
  console.log("Socket connected", socket.id);

  socket.on("join_room", ({ room_id }) => {
    socket.join(`room_${room_id}`);
    console.log("Socket joined room", room_id);
  });
  socket.on("leave_room", ({ room_id }) => {
    socket.leave(`room_${room_id}`);
  });
  // socket.on("start_game", ({ room_id }) => {
  //   // Only admin or server should call this; we will call engine instead.
  //   const engine = require("./socket/engine");
  //   engine.startGameEngine(io, room_id);
  // });
  socket.on("disconnect", () => {
    console.log("Socket disconnected", socket.id);
  });
});


 

// Start server
const PORT = 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server + Socket running on port ${PORT}`)
);
