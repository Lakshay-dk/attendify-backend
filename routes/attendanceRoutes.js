const express = require('express');
const {
	markAttendance,
	getAttendanceReport,
	getStudentAttendance,
	getAttendanceSummary,
	getSessionClassAverage,
} = require('../controllers/attendanceController');
const { protect, admin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Mark attendance by scanning QR (student)
router.post('/mark', protect, markAttendance);

// Live QR for teacher to view the current session QR
router.get('/live-qr/:classId', protect, admin, (req, res, next) => getLiveQR(req, res, next));

// Get attendance report (teacher)
router.get('/report', protect, admin, getAttendanceReport);

// Get summary for dashboard (teacher)
router.get('/summary', protect, admin, getAttendanceSummary);

// Get average attendance for a specific session (teacher)
router.get('/session-average', protect, admin, getSessionClassAverage);

// Get student's attendance history (student)
router.get('/history', protect, getStudentAttendance);

module.exports = router;
