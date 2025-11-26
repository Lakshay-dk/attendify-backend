const express = require('express');
const {
	getStudents,
	addStudent,
	generateQR,
	getStudentProfile,
	getClassStudentsWithAttendance,
} = require('../controllers/studentController');
const { protect, admin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/').get(protect, admin, getStudents).post(protect, admin, addStudent);
router.route('/profile').get(protect, getStudentProfile);
router.route('/:studentId/generate-qr').post(protect, admin, generateQR);

// Students with attendance for a specific class
router.get('/class/:classId/with-attendance', protect, admin, getClassStudentsWithAttendance);

module.exports = router;
