const express = require('express');
const router = express.Router();
const axios = require('axios');
const History = require('../models/History');

module.exports = (getExtractedText) => {
  router.post('/', async (req, res) => {
    const { documents, questions, sessionId } = req.body;
    const userId = req.user?.userId;

    console.log('Received request body:', req.body);

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: "no",
        error: "At least one question is required.",
      });
    }

    let pdfContent = '';
    if (documents && Array.isArray(documents) && documents.length > 0) {
      const docUrl = documents[0];
      try {
        console.log('Attempting to extract text from:', docUrl);
        pdfContent = await getExtractedText(docUrl) || '';
        console.log('Extracted text length:', pdfContent.length);
      } catch (extractErr) {
        console.error("❌ Document extraction error:", extractErr.message);
        pdfContent = '';
      }
    } else {
      console.log('No documents provided, using empty content');
    }

    try {
      console.log('Sending request to OpenRouter with queries:', JSON.stringify(questions));
      const result = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: "microsoft/mai-ds-r1:free",
          messages: [
            {
              role: "system",
              content:
                "You are an expert insurance assistant. Return a strict JSON response in this format:\n\n" +
                `{
  "answers": ["answer1", "answer2", "answer3", ...]
}\n\n` +
                "Each answer corresponds to a query provided by the user in the same order. Use information from the insurance document if available, otherwise provide a general response based on common insurance knowledge. Do not explain anything outside JSON."
            },
            {
              role: "user",
              content: `Insurance Document:\n${pdfContent}\n\nUser Queries: ${JSON.stringify(questions)}`
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
      console.log("🧠 RAW MODEL OUTPUT:\n", raw);

      let parsed;
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
          throw new Error("No JSON object found in response");
        }
        parsed = JSON.parse(match[0]);

        if (!parsed || !parsed.answers || !Array.isArray(parsed.answers)) {
          throw new Error("No valid answers array in response");
        }
        // Relax the length check to avoid false positives, log for debug
        if (parsed.answers.length !== questions.length) {
          console.warn(`Warning: Answer length (${parsed.answers.length}) does not match question length (${questions.length})`);
        }
      } catch (jsonErr) {
        console.error("❌ JSON Parse Error:", jsonErr.message, "Raw output:", raw);
        return res.status(500).json({
          success: "no",
          error: "Invalid JSON returned from model.",
          raw,
        });
      }

      const userMessage = { sender: 'user', text: JSON.stringify({ questions }), type: 'text' };
      const botMessage = { sender: 'bot', text: parsed, type: 'json' };

      let chatSession;
      if (userId) {
        if (sessionId) {
          chatSession = await History.findOne({ userId, sessionId });
          if (chatSession) {
            chatSession.messages.push(userMessage, botMessage);
            await chatSession.save();
          } else {
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
      } else {
        console.warn('No userId found, skipping chat session save');
        chatSession = { sessionId: 'temp-session' };
      }

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