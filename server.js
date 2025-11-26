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

// ----------------------------------------------------------
// ✅ FIXED CORS FOR NETLIFY (IMPORTANT FOR Live QR)
// ----------------------------------------------------------
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,           // e.g. https://your-site.netlify.app
      'http://localhost:5173',            // local development
    ],
    credentials: true,
  })
);

app.use(express.json());

// ----------------------------------------------------------
// ✅ ROOT ROUTE (MOVED ABOVE exports)
// ----------------------------------------------------------
app.get('/', (req, res) => {
  res.send('Attendify Backend is Live 🚀');
});

// ----------------------------------------------------------
// Routes
// ----------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sessions', sessionRoutes);

// ----------------------------------------------------------
// Error handler (MUST be last)
// ----------------------------------------------------------
app.use(errorHandler);

// ----------------------------------------------------------
// Server setup
// ----------------------------------------------------------
const PORT = process.env.PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Helpful listener for PORT issues
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please free it or change PORT in .env.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Export server/app
module.exports = { app, server };
