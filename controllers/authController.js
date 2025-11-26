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
    .filter(record => record.class)
    .map(record => ({
      classId: record.class._id.toString(),
      className: record.class.name,
      classCode: record.class.code,
      enrollmentNumber: record.enrollmentNumber,
      studentRecordId: record._id.toString()
    }));

  return {
    classes,
    defaultClassId: classes.length > 0 ? classes[0].classId : null,
    enrollmentNumber: classes.length > 0 ? classes[0].enrollmentNumber : null,
  };
};

/* ----------------------------------------------------
   REGISTER USER
---------------------------------------------------- */
const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role, enrollmentNumber, classId } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists)
    return res.status(400).json({ message: 'User already exists' });

  let pendingStudentRecord = null;

  if (role === 'student') {
    if (!enrollmentNumber)
      return res.status(400).json({ message: 'Enrollment number is required for students' });

    if (!classId)
      return res.status(400).json({ message: 'Class selection is required for students' });

    const existingStudent = await Student.findOne({ enrollmentNumber, class: classId });

    if (existingStudent && existingStudent.user)
      return res.status(400).json({ message: 'This enrollment number is already registered for this class' });

    if (existingStudent && !existingStudent.user)
      pendingStudentRecord = existingStudent;
  }

  const user = await User.create({ name, email, password, role });

  if (!user)
    return res.status(400).json({ message: 'Invalid user data' });

  let finalClassId = null;

  if (role === 'student') {
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
      finalClassId = pendingStudentRecord.class;
    } else {
      const student = await Student.create({
        name: user.name,
        enrollmentNumber,
        email: user.email,
        user: user._id,
        class: classId,
        teacher: classDoc.teacher,
      });
      finalClassId = student.class;
    }
  }

  const payload =
    role === 'student'
      ? await buildStudentClassPayload(user._id)
      : { classes: [], defaultClassId: null, enrollmentNumber: null };

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,

    // students get default class
    classId: payload.defaultClassId || finalClassId,

    // teachers get empty classes array
    classes: payload.classes,

    enrollmentNumber: payload.enrollmentNumber,
    token: generateToken(user._id),
  });
};

/* ----------------------------------------------------
   LOGIN USER
---------------------------------------------------- */
const authUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password)))
    return res.status(401).json({ message: 'Invalid email or password' });

  let classId = null;
  let classes = [];
  let enrollmentNumber = null;

  if (user.role === 'student') {
    const studentPayload = await buildStudentClassPayload(user._id);
    classId = studentPayload.defaultClassId;
    classes = studentPayload.classes;
    enrollmentNumber = studentPayload.enrollmentNumber;
  }

  // teachers & admins need a consistent response
  if (user.role === 'teacher' || user.role === 'admin') {
    classId = null;
    classes = [];
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
};

module.exports = { registerUser, authUser };
