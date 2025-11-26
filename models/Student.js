const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: false,
    sparse: true,
  },
  enrollmentNumber: {
    type: String,
    required: true,
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  attendancePercentage: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

studentSchema.index({ enrollmentNumber: 1, class: 1, teacher: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
