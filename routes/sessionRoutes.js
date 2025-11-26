const express = require('express');
const { generateSessionQR, getActiveSession, endSession } = require('../controllers/sessionController');
const { protect, admin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Generate session QR (teacher only)
router.post('/generate', protect, admin, generateSessionQR);

// Get active session for a class
router.get('/active/:classId', protect, getActiveSession);

// End session (teacher only)
router.post('/:sessionId/end', protect, admin, endSession);

module.exports = router;
