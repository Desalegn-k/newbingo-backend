// scripts/generateFixedCards.js
const db = require("../config/db");

const { generateBingoCard } = require("../utils/generateCard");


(async () => {
  try {
    console.log("Generating 100 fixed cards...");

    for (let i = 1; i <= 150; i++) {
      const card = generateBingoCard();
      await db.query("INSERT INTO fixed_cards (id, card) VALUES (?, ?)", [
        i,
        JSON.stringify(card),
      ]);
      console.log(`Card ${i} saved`);
    }

    console.log("Done! 100 fixed cards inserted.");
    process.exit();
  } catch (err) {
    console.error("Error generating cards:", err);
    process.exit(1);
  }
})();
