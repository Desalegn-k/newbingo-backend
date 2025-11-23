// utils/checkWinner.js

exports.checkBingoWinner = (card) => {
  const grid = [card.B, card.I, card.N, card.G, card.O];

  // Helper: check if a cell is marked
  const isMarked = (v) => v === "FREE" || v?.marked === true;

  // Check rows
  for (let i = 0; i < 5; i++) {
    const row = grid.map((col) => col[i]); // get ith element from each column
    if (row.every(isMarked)) return true;
  }

  // Check columns
  for (let c of grid) {
    if (c.every(isMarked)) return true;
  }

  // Check diagonals
  const d1 = [grid[0][0], grid[1][1], grid[2][2], grid[3][3], grid[4][4]];
  const d2 = [grid[0][4], grid[1][3], grid[2][2], grid[3][1], grid[4][0]];
  if (d1.every(isMarked) || d2.every(isMarked)) return true;

  // Check 4 corners
  const corners = [grid[0][0], grid[0][4], grid[4][0], grid[4][4]];
  if (corners.every(isMarked)) return true;

  return false;
};
