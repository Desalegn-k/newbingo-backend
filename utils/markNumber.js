// utils/markNumber.js

/**
 * card: { B: [..], I: [..], N: [..], G: [..], O: [..] }
 * number: string like "B12", "O73"
 */
exports.markNumberOnCard = (card, number) => {
  if (!number || typeof number !== "string") return card;

  const col = number.charAt(0);
  const num = Number(number.slice(1));

  if (card[col]) {
    card[col] = card[col].map((v) => {
      if (typeof v === "object") return v; // already marked
      if (v === num) return { value: v, marked: true };
      return v;
    });
  }

  return card;
};

