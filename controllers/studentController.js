const Student = require('../models/Student');
const User = require('../models/User');
const QRCode = require('qrcode');
const Attendance = require('../models/Attendance');

const getStudents = async (req, res) => {
  try {
    const students = await Student.find().populate('user', 'name email');
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addStudent = async (req, res) => {
  const { name, email, rollNumber } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password: 'defaultpassword', // In real app, generate or ask for password
      role: 'student',
    });

    const qrCodeData = `${user._id}-${rollNumber}`;
    const qrCode = await QRCode.toDataURL(qrCodeData);

    const student = await Student.create({
      name,
      email,
      rollNumber,
      qrCode,
      user: user._id,
    });

    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateQR = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const qrCodeData = `${student.user}-${student.rollNumber}`;
    const qrCode = await QRCode.toDataURL(qrCodeData);

    student.qrCode = qrCode;
    await student.save();

    res.json({ qrCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get students in a class with attendance percentage
const getClassStudentsWithAttendance = async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  try {
    // Get all students for this class and teacher
    const students = await Student.find({ class: classId, teacher: teacherId }).lean();

    if (students.length === 0) {
      return res.json([]);
    }

    const studentIds = students.map((s) => s._id);

    // Fetch attendance records for these students
    const attendanceRecords = await Attendance.find({
      student: { $in: studentIds },
      class: classId,
    })
      .select('student status')
      .lean();

    // Compute percentage per student
    const attendanceByStudent = {};
    for (const rec of attendanceRecords) {
      const key = rec.student.toString();
      if (!attendanceByStudent[key]) {
        attendanceByStudent[key] = { total: 0, present: 0 };
      }
      attendanceByStudent[key].total += 1;
      if (rec.status && rec.status.toLowerCase() === 'present') {
        attendanceByStudent[key].present += 1;
      }
    }

    const result = students.map((s) => {
      const stats = attendanceByStudent[s._id.toString()] || { total: 0, present: 0 };
      const percentage =
        stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        enrollmentNumber: s.enrollmentNumber,
        attendancePercentage: Number(percentage.toFixed(2)),
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get student's own profile
const getStudentProfile = async (req, res) => {
  try {
    const students = await Student.find({ user: req.user._id })
      .populate('class', 'name code')
      .populate('teacher', 'name email')
      .lean();

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const primary = students[0];
    const classes = students
      .filter((record) => record.class)
      .map((record) => ({
        classId: record.class._id.toString(),
        className: record.class.name,
        classCode: record.class.code,
        teacherName: record.teacher?.name || '',
        studentRecordId: record._id.toString(),
        enrollmentNumber: record.enrollmentNumber,
      }));

    res.json({
      ...primary,
      classes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getStudents,
  addStudent,
  generateQR,
  getStudentProfile,
  getClassStudentsWithAttendance,
};
