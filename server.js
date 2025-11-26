const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const classRoutes = require('./routes/classRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

const { errorHandler } = require('./middlewares/errorHandler');

dotenv.config();
connectDB();

const app = express();

// ======================================================
// 🚀 FIXED CORS (WORKS FOR NETLIFY + LOCALHOST)
// ======================================================
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "*",   // Netlify or frontend URL
      "http://localhost:5173",           // Dev frontend
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// ======================================================
// ROOT ROUTE
// ======================================================
app.get("/", (req, res) => {
  res.send("Attendify Backend is Live 🚀");
});

// ======================================================
// ROUTES
// ======================================================
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sessions', sessionRoutes);

// ======================================================
// ERROR HANDLER (last middleware)
// ======================================================
app.use(errorHandler);

// ======================================================
// SERVER START
// ======================================================
const PORT = process.env.PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`🚀 Attendify Backend running on port ${PORT}`);
});

// PORT ISSUE HANDLING
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});

module.exports = { app, server };
