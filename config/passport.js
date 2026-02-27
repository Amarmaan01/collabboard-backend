const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Check if a user exists with the same email (registered normally)
        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await User.findOne({ email: email.toLowerCase() });

          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            user.avatar = profile.photos?.[0]?.value || "";
            await user.save();
            return done(null, user);
          }
        }

        // Create new user from Google profile
        user = await User.create({
          name: profile.displayName,
          email: email?.toLowerCase(),
          googleId: profile.id,
          avatar: profile.photos?.[0]?.value || "",
        });

        done(null, user);
      } catch (error) {
        console.error("Google strategy error:", error);
        done(error, null);
      }
    }
  )
);

module.exports = passport;
