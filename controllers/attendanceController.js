const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Session = require('../models/Session');

// Mark attendance by scanning QR code
const markAttendance = async (req, res) => {
  const { sessionId } = req.body;
  const studentId = req.user._id;

  try {
    // Find student record
    const student = await Student.findOne({ user: studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find session
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Invalid session' });
    }

    // Check if session is still active
    if (!session.isActive || session.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Session has expired' });
    }

    // Check if attendance already marked for this session
    const existingAttendance = await Attendance.findOne({
      student: student._id,
      session: session._id,
    });

    if (existingAttendance) {
      return res.status(400).json({ message: 'Attendance already marked for this session' });
    }

    // Mark attendance
    const attendance = await Attendance.create({
      student: student._id,
      session: session._id,
      class: session.class,
      teacher: session.teacher,
      status: 'present',
    });

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get attendance report for teacher
const getAttendanceReport = async (req, res) => {
  const { classId, startDate, endDate, studentId } = req.query;
  const teacherId = req.user._id;

  try {
    let query = { teacher: teacherId };

    if (classId) query.class = classId;
    if (studentId) query.student = studentId;
    if (startDate || endDate) {
      query.scanTime = {};
      if (startDate) query.scanTime.$gte = new Date(startDate);
      if (endDate) query.scanTime.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'name enrollmentNumber')
      .populate('session', 'lectureTiming')
      .populate('class', 'name');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get student attendance history
const getStudentAttendance = async (req, res) => {
  const studentId = req.user._id;
  const { classId } = req.query;

  try {
    const student = await Student.findOne({ user: studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const attendanceFilter = { student: student._id };
    if (classId) {
      attendanceFilter.class = classId;
    }

    const attendance = await Attendance.find(attendanceFilter)
      .populate('session', 'lectureTiming')
      .populate('class', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const formattedRecords = attendance.map((record) => ({
      _id: record._id,
      status: record.status === 'present' ? 'Present' : 'Absent',
      createdAt: record.createdAt,
      scanTime: record.scanTime,
      className: record.class?.name || 'Class',
      sessionTiming: record.session?.lectureTiming || '',
    }));

    const totalSessions = formattedRecords.length;
    const presentCount = formattedRecords.filter((rec) => rec.status === 'Present').length;
    const percentage = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

    res.json({
      attendanceRecords: formattedRecords,
      percentage: Number(percentage.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get attendance summary for teacher dashboard
const getAttendanceSummary = async (req, res) => {
  const { classId } = req.query;
  const teacherId = req.user._id;

  try {
    // Filter attendance by teacher and optional class
    const baseAttendanceQuery = { teacher: teacherId };
    if (classId) baseAttendanceQuery.class = classId;

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Present today (per student, per class)
    const presentToday = await Attendance.countDocuments({
      ...baseAttendanceQuery,
      status: 'present',
      scanTime: { $gte: today, $lt: tomorrow },
    });

    // Total students in this teacher's class (or all classes)
    const studentQuery = { teacher: teacherId };
    if (classId) studentQuery.class = classId;
    const totalStudents = await Student.countDocuments(studentQuery);

    // Average attendance for today as a percentage of students
    const averageAttendance =
      totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0;

    // Recent logs for this class/teacher today (most recent first)
    const recentLogs = await Attendance.find({
      ...baseAttendanceQuery,
      scanTime: { $gte: today, $lt: tomorrow },
    })
      .populate('student', 'name enrollmentNumber')
      .populate('class', 'name code')
      .sort({ scanTime: -1 })
      .limit(10)
      .lean();

    const recentLogsMapped = recentLogs.map((log) => ({
      _id: log._id,
      studentName: log.student?.name || 'Unknown',
      scanTime: log.scanTime,
      status: log.status,
      className: log.class?.name || '',
      classCode: log.class?.code || '',
    }));

    res.json({
      totalStudents,
      presentToday: presentToday,
      averageAttendance,
      recentLogs: recentLogsMapped,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get average attendance for a single session in a class
const getSessionClassAverage = async (req, res) => {
  const { sessionId } = req.query; // string SESSION-* id
  const teacherId = req.user._id;

  try {
    const session = await Session.findOne({ sessionId, teacher: teacherId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const totalStudents = await Student.countDocuments({ class: session.class });
    const presentCount = await Attendance.countDocuments({
      session: session._id,
      status: 'present',
    });

    const percentage = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

    res.json({
      sessionId,
      classId: session.class,
      totalStudents,
      presentCount,
      averageAttendance: Number(percentage.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get live QR for a class (for teachers)
const getLiveQR = async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  try {
    // Find the most recent active session for this class
    const session = await Session.findOne({ class: classId, isActive: true })
      .populate('class', 'name code subject')
      .sort({ createdAt: -1 })
      .lean();

    if (!session) {
      return res.status(404).json({ message: 'No active session found for this class' });
    }

    // Return QR image, expiry and class details
    res.json({
      qrImage: session.qrCode,
      expiresAt: session.expiresAt,
      sessionId: session.sessionId,
      classDetails: session.class || {},
      lectureTiming: session.lectureTiming,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  markAttendance,
  getAttendanceReport,
  getStudentAttendance,
  getAttendanceSummary,
  getSessionClassAverage,
  getLiveQR,
};
