const Class = require('../models/Class');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// Get all classes (for student registration)
const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find().populate('teacher', 'name email').select('name description teacher');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new class
const createClass = async (req, res) => {
  const { name, description } = req.body;
  const teacherId = req.user._id;

  try {
    const classCode = `CLASS-${Date.now()}`;
    
    const newClass = await Class.create({
      name,
      description,
      teacher: teacherId,
      code: classCode,
    });

    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all classes for a teacher
const getTeacherClasses = async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.user._id });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get students in a class
const getClassStudents = async (req, res) => {
  const { classId } = req.params;

  try {
    const students = await Student.find({ class: classId }).populate('user', 'name email');
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add student to class
const addStudentToClass = async (req, res) => {
  const { classId } = req.params;
  const { name, enrollmentNumber } = req.body;
  const teacherId = req.user._id;

  if (!name || !enrollmentNumber) {
    return res.status(400).json({ message: 'Name and enrollment number are required' });
  }

  try {
    // Check if student with this enrollment number already exists in this class
    const existingStudent = await Student.findOne({ enrollmentNumber, class: classId });
    if (existingStudent) {
      return res.status(400).json({ message: 'Student with this enrollment number already exists in this class' });
    }

    // Try to link to an existing registered student (same enrollment number)
    const linkedStudent = await Student.findOne({ enrollmentNumber, user: { $ne: null } })
      .sort({ createdAt: 1 })
      .populate('user', 'email name');

    const linkedUserId = linkedStudent?.user?._id || null;
    const linkedEmail = linkedStudent?.email || linkedStudent?.user?.email || null;
    const linkedName = linkedStudent?.name || linkedStudent?.user?.name || null;

    // Create student record (reuse user/email when available)
    const student = await Student.create({
      name: name || linkedName || 'Student',
      email: linkedEmail,
      enrollmentNumber,
      class: classId,
      teacher: teacherId,
      user: linkedUserId,
    });

    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeStudentFromClass = async (req, res) => {
  const { classId, studentId } = req.params;
  const teacherId = req.user._id;

  try {
    const student = await Student.findOne({ _id: studentId, class: classId, teacher: teacherId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found in this class' });
    }

    await Attendance.deleteMany({ student: student._id, class: classId });
    await student.deleteOne();

    res.json({ message: 'Student removed from class' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createClass, getTeacherClasses, getClassStudents, addStudentToClass, getAllClasses, removeStudentFromClass };
