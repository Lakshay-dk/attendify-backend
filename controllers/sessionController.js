const Session = require('../models/Session');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Generate session QR code
const generateSessionQR = async (req, res) => {
  const { classId, lectureTiming, duration } = req.body;
  const teacherId = req.user._id;

  try {
    // Create unique session ID
    const sessionId = `SESSION-${classId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Calculate expiry time (default 2 hours from now)
    const expiresAt = new Date(Date.now() + (duration || 120) * 60 * 1000);
    
    // QR code data contains sessionId for verification
    const qrData = JSON.stringify({
      sessionId,
      classId,
      lectureTiming,
      timestamp: new Date(),
    });

    const qrCode = await QRCode.toDataURL(qrData);

    // Save session to database
    const session = await Session.create({
      sessionId,
      class: classId,
      teacher: teacherId,
      qrCode,
      lectureTiming,
      expiresAt,
    });

    res.status(201).json({
      sessionId: session.sessionId,
      qrCode: session.qrCode,
      lectureTiming: session.lectureTiming,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get active session for a class
const getActiveSession = async (req, res) => {
  const { classId } = req.params;

  try {
    // Find the most recent active session for this class
    const session = await Session.findOne({
      class: classId,
      isActive: true,
    }).sort({ createdAt: -1 });

    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ message: 'No active session found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// End session
const endSession = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await Session.findByIdAndUpdate(
      sessionId,
      { isActive: false },
      { new: true }
    );

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generateSessionQR, getActiveSession, endSession };
