// ✅ index.js (main server file)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const passport = require('passport');
require('./config/passport');

const app = express();

// ✅ Secure CORS setup
const allowedOrigins = ['https://ai-ja3l.onrender.com', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow curl/postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('❌ Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(passport.initialize());

// ✅ Log requests for debugging
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// ✅ MongoDB Connect
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection failed:", err));

// ✅ Routes
const authRoute = require('./routes/authRoute');
const uploadModule = require('./routes/uploadRoute');
const uploadRoute = uploadModule.router;
const getExtractedText = uploadModule.getExtractedText;
const queryRoute = require('./routes/queryRoute')(getExtractedText);
const historyRoute = require('./routes/historyRoute');

// ✅ Public Auth Routes
app.use('/api/auth', authRoute);

// ✅ JWT Auth Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '❌ No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: '❌ Invalid or expired token' });
  }
};

// ✅ Protected Routes (Upload, Query, History)
app.use('/api/upload', verifyToken, uploadRoute);
app.use('/api/query', verifyToken, queryRoute);
app.use('/api/history', verifyToken, historyRoute);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
