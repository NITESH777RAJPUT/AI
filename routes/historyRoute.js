const express = require('express');
const router = express.Router();
const History = require('../models/History');

// Get all chat sessions for the authenticated user
router.get('/', async (req, res) => {
  try {
    // Only return the session ID and creation date for the sidebar list
    const histories = await History.find({ userId: req.user.userId })
      .select('sessionId createdAt')
      .sort({ createdAt: -1 })
      .limit(50); // Limit to recent 50 sessions
    res.json(histories);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get a specific chat session by sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const history = await History.findOne({
      userId: req.user.userId,
      sessionId: req.params.sessionId,
    });
    if (!history) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    res.json(history);
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).json({ error: 'Failed to fetch chat session' });
  }
});

module.exports = router;