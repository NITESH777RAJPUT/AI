const express = require('express');
const router = express.Router();
const axios = require('axios');
const Chat = require('../models/Chat');

module.exports = (getExtractedText) => {
  router.post('/', async (req, res) => {
    const { query } = req.body;

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
              content: "You are a helpful assistant that answers questions based on insurance policy documents. Use the provided PDF content to answer.",
            },
            {
              role: "user",
              content: `PDF Content:\n${pdfContent.substring(0, 3000)}\n\nUser Query: ${query}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // 🧹 Clean the response
      let answer = result.data?.choices?.[0]?.message?.content || '⚠️ No response from model';
      answer = answer
        .replace(/\*\*/g, '')              // remove bold markdown
        .replace(/\n{2,}/g, '\n')          // collapse multiple newlines into one
        .replace(/[ \t]+\n/g, '\n')        // remove spaces before line breaks
        .trim();

      // ✅ Save to DB
      await Chat.create({
        userId: req.user?.id || 'anonymous',
        query,
        answer,
        timestamp: new Date(),
      });

      // ✅ Return answer as array of lines
      res.json({
        success: "yes",
        answer: answer.split('\n').filter(line => line.trim() !== ''),
      });

    } catch (err) {
      console.error("OpenRouter Error:", err.response?.data || err.message);
      res.status(500).json({
        success: "no",
        error: "❌ OpenRouter failed to respond",
        details: err.response?.data || err.message || 'Unknown error',
      });
    }
  });

  return router;
};
