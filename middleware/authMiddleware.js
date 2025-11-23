const jwt = require("jsonwebtoken");

// Middleware to verify JWT token
exports.verifyToken = (req, res, next) => {
  try {
    // Expect token in Authorization header: "Bearer <token>"
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token using the same secret key used in login controller
    const secretKey = "secret123"; // Hardcoded for now, matches login controller
    const decoded = jwt.verify(token, secretKey);

    // Attach decoded user data to the request
    req.user = decoded;

    next(); // Continue to next middleware or controller
  } catch (error) {
    console.error("❌ Invalid token:", error.message);
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};
