const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'bot', 'status'],
    required: true,
  },
  text: {
    type: mongoose.Mixed, // Can store string or object (for JSON responses)
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'json', 'status'],
    default: 'text',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(), // Unique session ID
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('History', historySchema);