const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://ai-ja3l.onrender.com/api/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const googleId = profile.id;

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      name: profile.displayName,
      googleId
    });
  }

  return done(null, user);
}));
