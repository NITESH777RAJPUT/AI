const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  input: String,
  output: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Query', querySchema);
