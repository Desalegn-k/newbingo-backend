const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ msg: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, "secret123");

    // Check if the user is admin
    if (decoded.role !== "admin") {
      return res.status(403).json({ msg: "Access denied. Admin only." });
    }

    req.user = decoded; // save decoded data for next controllers
    next();
  } catch (err) {
    return res.status(400).json({ msg: "Invalid token" });
  }
};
