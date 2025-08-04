const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    default: null // Will be null for Google users
  },
  name: {
    type: String,
    default: ''  // Name from Google or manual entry
  },
  googleId: {
    type: String,
    default: null // Will be filled only for Google login
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
