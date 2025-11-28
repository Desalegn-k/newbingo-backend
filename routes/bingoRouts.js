// routes/bingoRoutes.js

const express = require("express");
const router = express.Router();

const bingo = require("../controllers/bingoController");

// (IF you use auth) — uncomment when needed
const { verifyToken } = require("../middleware/authMiddleware");
const {verifyadmin}=require("../middleware/verifyAdmin");

// PUBLIC ROUTES (no auth needed)
// Create room (admin can hit this)
router.post("/create-room", bingo.createRoom);
router.post("/start", bingo.startCountdown);

router.get("/current-countdown/:room_id", bingo.getCurrentCountdown);


// Get all available rooms
router.get("/rooms", bingo.getAvailableRooms);

// -----------------------------------------------
// PROTECTED ROUTES (if using token auth)
// Uncomment verifyToken if needed
// -----------------------------------------------

// Join room
router.post("/join", verifyToken, bingo.joinRoom);
// router.post("/join", bingo.joinRoom);

// Select card
router.post("/select-card", verifyToken, bingo.selectCard);
// router.post("/select-card", bingo.selectCard);

// Confirm card + deduct balance + start countdown
router.post("/confirm-card", verifyToken, bingo.confirmCard);
// router.post("/confirm-card", bingo.confirmCard);
router.get("/taken/:room_id", bingo.getTakenNumbers);
router.get("/prize/:roomId", bingo.getPrize);

// Get room state
router.get("/state", bingo.getRoomState);

// Claim bingo
router.post("/claim", verifyToken, bingo.claimBingo);
 


// router.post("/claim", bingo.claimBingo);

module.exports = router;
