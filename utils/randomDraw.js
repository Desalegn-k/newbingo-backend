// utils/randomDraw.js

// utils/randomDraw.js

// Map number to column
function getColumn(num) {
  if (num >= 1 && num <= 15) return "B";
  if (num >= 16 && num <= 30) return "I";
  if (num >= 31 && num <= 45) return "N";
  if (num >= 46 && num <= 60) return "G";
  if (num >= 61 && num <= 75) return "O";
  return "?";
}

exports.generateDrawSequence = (max = 75) => {
  const arr = [];
  for (let i = 1; i <= max; i++) arr.push(i);

  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // map to "B12", "O73", etc.
  return arr.map((num) => getColumn(num) + num);
};
