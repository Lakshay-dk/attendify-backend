const express = require('express');
const { createClass, getTeacherClasses, getClassStudents, addStudentToClass, getAllClasses, removeStudentFromClass } = require('../controllers/classController');
const { protect, admin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Get all classes (public for student registration)
router.get('/all', getAllClasses);

// Create class (teacher only)
router.post('/', protect, admin, createClass);

// Get all classes for teacher
router.get('/', protect, admin, getTeacherClasses);

// Get students in a class
router.get('/:classId/students', protect, admin, getClassStudents);

// Add student to class
router.post('/:classId/students', protect, admin, addStudentToClass);

// Remove student from class
router.delete('/:classId/students/:studentId', protect, admin, removeStudentFromClass);

module.exports = router;
