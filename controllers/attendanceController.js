const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Session = require('../models/Session');

/* ----------------------------------------------------
   MARK ATTENDANCE (student scans QR)
---------------------------------------------------- */
const markAttendance = async (req, res) => {
  const { sessionId } = req.body;
  const studentId = req.user._id;

  try {
    const student = await Student.findOne({ user: studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Invalid session' });
    }

    if (!session.isActive || session.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Session has expired' });
    }

    const existingAttendance = await Attendance.findOne({
      student: student._id,
      session: session._id,
    });

    if (existingAttendance) {
      return res.status(400).json({ message: 'Attendance already marked for this session' });
    }

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

/* ----------------------------------------------------
   GET QR FOR STUDENTS + TEACHERS (Unified)
---------------------------------------------------- */
const getQRForClass = async (req, res) => {
  const { classId } = req.params;

  try {
    // Most recent active session
    const session = await Session.findOne({ class: classId, isActive: true })
      .sort({ createdAt: -1 })
      .populate("class", "name code subject")
      .lean();

    if (!session) {
      return res.status(404).json({ message: "No active session found for this class" });
    }

    // Calculate expiry in seconds
    const now = Date.now();
    const expiresIn = Math.max(0, Math.floor((session.expiresAt - now) / 1000));

    // If expired, let frontend show expired message
    if (expiresIn <= 0) {
      return res.json({
        qrImage: null,
        expiresIn: 0,
        message: "Session expired",
      });
    }

    return res.json({
      qrImage: session.qrCode,
      expiresIn,
      sessionId: session.sessionId,
      classDetails: session.class,
      lectureTiming: session.lectureTiming,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ----------------------------------------------------
   ATTENDANCE REPORT FOR TEACHER
---------------------------------------------------- */
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

/* ----------------------------------------------------
   GET STUDENT ATTENDANCE HISTORY
---------------------------------------------------- */
const getStudentAttendance = async (req, res) => {
  const studentId = req.user._id;
  const { classId } = req.query;

  try {
    const student = await Student.findOne({ user: studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const filter = { student: student._id };
    if (classId) filter.class = classId;

    const attendance = await Attendance.find(filter)
      .populate('session', 'lectureTiming')
      .populate('class', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = attendance.map((r) => ({
      _id: r._id,
      status: r.status === "present" ? "Present" : "Absent",
      scanTime: r.scanTime,
      createdAt: r.createdAt,
      className: r.class?.name || "Class",
      sessionTiming: r.session?.lectureTiming || "",
    }));

    const total = formatted.length;
    const present = formatted.filter((x) => x.status === "Present").length;
    const percentage = total > 0 ? Number(((present / total) * 100).toFixed(2)) : 0;

    res.json({
      attendanceRecords: formatted,
      percentage,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ----------------------------------------------------
   TEACHER DASHBOARD SUMMARY
---------------------------------------------------- */
const getAttendanceSummary = async (req, res) => {
  const { classId } = req.query;
  const teacherId = req.user._id;

  try {
    const baseQuery = { teacher: teacherId };
    if (classId) baseQuery.class = classId;

    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const presentToday = await Attendance.countDocuments({
      ...baseQuery,
      status: 'present',
      scanTime: { $gte: today, $lt: tomorrow },
    });

    const studentQuery = { teacher: teacherId };
    if (classId) studentQuery.class = classId;
    const totalStudents = await Student.countDocuments(studentQuery);

    const averageAttendance =
      totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0;

    const recentLogs = await Attendance.find({
      ...baseQuery,
      scanTime: { $gte: today, $lt: tomorrow },
    })
      .populate('student', 'name enrollmentNumber')
      .populate('class', 'name code')
      .sort({ scanTime: -1 })
      .limit(10)
      .lean();

    const formattedLogs = recentLogs.map((log) => ({
      _id: log._id,
      studentName: log.student?.name || 'Unknown',
      scanTime: log.scanTime,
      status: log.status,
      className: log.class?.name || '',
      classCode: log.class?.code || '',
    }));

    res.json({
      totalStudents,
      presentToday,
      averageAttendance,
      recentLogs: formattedLogs,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ----------------------------------------------------
   GET CLASS SESSION AVERAGE
---------------------------------------------------- */
const getSessionClassAverage = async (req, res) => {
  const { sessionId } = req.query;
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

/* ----------------------------------------------------
   EXPOSE FUNCTIONS
---------------------------------------------------- */
module.exports = {
  markAttendance,
  getQRForClass,           // ⭐ unified QR (teacher + student)
  getAttendanceReport,
  getStudentAttendance,
  getAttendanceSummary,
  getSessionClassAverage,
};
