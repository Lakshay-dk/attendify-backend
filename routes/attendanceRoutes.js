const express = require('express');
const {
  markAttendance,
  getAttendanceReport,
  getStudentAttendance,
  getAttendanceSummary,
  getSessionClassAverage,
  getQRForClass,   // ✅ NEW unified QR handler
} = require('../controllers/attendanceController');

const { protect, admin } = require('../middlewares/authMiddleware');

const router = express.Router();

/* ----------------------------------------------------
   MARK ATTENDANCE (STUDENT SCANS QR)
---------------------------------------------------- */
router.post('/mark', protect, markAttendance);

/* ----------------------------------------------------
   GET QR (UNIFIED ENDPOINT)
   Students → fetch QR to scan
   Teachers → fetch QR to display in Live Session
---------------------------------------------------- */
router.get('/qr/:classId', protect, getQRForClass);

/* ----------------------------------------------------
   ATTENDANCE REPORT (TEACHER)
---------------------------------------------------- */
router.get('/report', protect, admin, getAttendanceReport);

/* ----------------------------------------------------
   DASHBOARD SUMMARY (TEACHER)
---------------------------------------------------- */
router.get('/summary', protect, admin, getAttendanceSummary);

/* ----------------------------------------------------
   SESSION AVERAGE (TEACHER)
---------------------------------------------------- */
router.get('/session-average', protect, admin, getSessionClassAverage);

/* ----------------------------------------------------
   STUDENT ATTENDANCE HISTORY (STUDENT)
---------------------------------------------------- */
router.get('/history', protect, getStudentAttendance);

module.exports = router;
