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
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sessions', sessionRoutes);

// Error handler (should be last)
app.use(errorHandler);

// Use PORT from env (you chose to keep 5002) or fallback
const PORT = process.env.PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Helpful error listener for common "address in use" issue
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the process using that port or change PORT in your .env.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

module.exports = { app, server };
app.get("/", (req, res) => {
  res.send("Attendify Backend is Live 🚀");
});
