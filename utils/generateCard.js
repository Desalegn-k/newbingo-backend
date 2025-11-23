//utils/generateCard.js

function getRandomNumbers(min, max, count) {
  const s = new Set();
  while (s.size < count)
    s.add(Math.floor(Math.random() * (max - min + 1)) + min);
  return Array.from(s);
}

exports.generateBingoCard = () => ({
  B: getRandomNumbers(1, 15, 5),
  I: getRandomNumbers(16, 30, 5),
  N: [
    ...getRandomNumbers(31, 45, 4).slice(0, 2),
    "FREE",
    ...getRandomNumbers(31, 45, 4).slice(2),
  ],
  G: getRandomNumbers(46, 60, 5),
  O: getRandomNumbers(61, 75, 5),
});
