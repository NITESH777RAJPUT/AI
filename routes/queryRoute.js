const express = require('express');
const router = express.Router();
const axios = require('axios');
const History = require('../models/History');

module.exports = (getExtractedText) => {
  router.post('/', async (req, res) => {
    const { query, sessionId } = req.body;
    const userId = req.user.userId;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: "no",
        error: "Query is required.",
      });
    }

    const pdfContent = getExtractedText();

    if (!pdfContent || pdfContent.trim() === '') {
      return res.status(400).json({
        success: "no",
        error: "No PDF content available. Upload a document first.",
      });
    }

    try {
      const result = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: "microsoft/mai-ds-r1:free",
          messages: [
            {
              role: "system",
              content:
                "You are an expert insurance assistant. You must return a strict JSON response in this format:\n\n" +
                `{
  "decision": "yes" | "No",
  "amount": number,
  "justification": "reason referencing clause number and explanation"
}\n\n` +
                "Use only information from the insurance document. Do not explain anything outside JSON."
            },
            {
              role: "user",
              content: `Insurance Document:\n${pdfContent}\n\nUser Query: ${query}`
            }
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const raw = result.data?.choices?.[0]?.message?.content?.trim();
      console.log("🧠 RAW MODEL OUTPUT:\n", raw); // Debug output

      let parsed;
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : null;

        if (!parsed) throw new Error("No valid JSON structure detected");

      } catch (jsonErr) {
        console.error("❌ JSON Parse Error:", jsonErr.message);
        return res.status(500).json({
          success: "no",
          error: "Invalid JSON returned from model.",
          raw,
        });
      }

      const userMessage = { sender: 'user', text: query, type: 'text' };
      const botMessage = { sender: 'bot', text: parsed, type: 'json' };

      let chatSession;

      if (sessionId) {
        chatSession = await History.findOne({ userId, sessionId });
        if (chatSession) {
          chatSession.messages.push(userMessage, botMessage);
          await chatSession.save();
        } else {
          // Fallback to creating a new session if ID is not found
          chatSession = await History.create({
            userId,
            messages: [userMessage, botMessage],
          });
        }
      } else {
        chatSession = await History.create({
          userId,
          messages: [userMessage, botMessage],
        });
      }
      
      // Return the parsed response along with the new session ID
      res.json({ ...parsed, sessionId: chatSession.sessionId });

    } catch (err) {
      console.error("🚨 OpenRouter Error:", err.response?.data || err.message);
      res.status(500).json({
        success: "no",
        error: "❌ OpenRouter failed to respond",
        details: err.response?.data || err.message || 'Unknown error',
      });
    }
  });

  return router;
};