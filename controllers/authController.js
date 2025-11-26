const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const buildStudentClassPayload = async (userId) => {
  const studentRecords = await Student.find({ user: userId })
    .populate('class', 'name code')
    .lean();

  const classes = studentRecords
    .filter((record) => record.class)
    .map((record) => ({
      classId: record.class._id.toString(),
      className: record.class.name,
      classCode: record.class.code,
      enrollmentNumber: record.enrollmentNumber,
      studentRecordId: record._id.toString(),
    }));

  const defaultClassId = classes.length > 0 ? classes[0].classId : null;
  const enrollmentNumber = classes.length > 0 ? classes[0].enrollmentNumber : null;

  return { classes, defaultClassId, enrollmentNumber };
};

const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role, enrollmentNumber, classId } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  let pendingStudentRecord = null;

  // If student, validate required fields
  if (role === 'student') {
    if (!enrollmentNumber) {
      return res.status(400).json({ message: 'Enrollment number is required for students' });
    }
    if (!classId) {
      return res.status(400).json({ message: 'Class selection is required for students' });
    }
    // Check if enrollment number is already used
    const existingStudent = await Student.findOne({ enrollmentNumber, class: classId });
    if (existingStudent && existingStudent.user) {
      return res.status(400).json({ message: 'This enrollment number is already registered for this class' });
    }
    if (existingStudent && !existingStudent.user) {
      pendingStudentRecord = existingStudent;
    }
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
  });

  if (user) {
    let studentClassId = null;
    if (user.role === 'student') {
      // Create a new student record
      const classDoc = await Class.findById(classId);
      if (!classDoc) {
        await User.findByIdAndDelete(user._id);
        return res.status(404).json({ message: 'Class not found' });
      }
      if (pendingStudentRecord) {
        pendingStudentRecord.user = user._id;
        pendingStudentRecord.name = user.name;
        pendingStudentRecord.email = user.email;
        await pendingStudentRecord.save();
        studentClassId = pendingStudentRecord.class;
      } else {
        const student = await Student.create({
          name: user.name,
          enrollmentNumber,
          email: user.email,
          user: user._id,
          class: classId,
          teacher: classDoc.teacher,
        });
        studentClassId = student.class;
      }
    }

    const studentClassPayload = user.role === 'student'
      ? await buildStudentClassPayload(user._id)
      : { classes: [], defaultClassId: null, enrollmentNumber: null };

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      classId: studentClassPayload.defaultClassId || studentClassId,
      classes: studentClassPayload.classes,
      enrollmentNumber: studentClassPayload.enrollmentNumber,
      token: generateToken(user._id),
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
};

const authUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    let classId = null;
    let classes = [];
    let enrollmentNumber = null;

    if (user.role === 'student') {
      const payload = await buildStudentClassPayload(user._id);
      classId = payload.defaultClassId;
      classes = payload.classes;
      enrollmentNumber = payload.enrollmentNumber;
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      classId,
      classes,
      enrollmentNumber,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: 'Invalid email or password' });
  }
};

module.exports = { registerUser, authUser };
