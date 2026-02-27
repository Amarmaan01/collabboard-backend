const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

module.exports = { cookieOptions };
