const Session = require('../models/Session');
const QRCode = require('qrcode');
const crypto = require('crypto');

/* ----------------------------------------------------
   Generate a new QR Session (Teacher only)
---------------------------------------------------- */
const generateSessionQR = async (req, res) => {
  const { classId, lectureTiming, durationMinutes } = req.body;
  const teacherId = req.user._id;

  try {
    // 💡 Make a unique readable session ID
    const sessionId = `SESSION-${classId}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // 💡 Duration in minutes (fallback = 60)
    const duration = durationMinutes || 60;

    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    // QR data encoded as JSON
    const qrData = JSON.stringify({
      sessionId,
      classId,
      lectureTiming,
      timestamp: new Date(),
    });

    // Generate QR as base64 PNG
    const qrCode = await QRCode.toDataURL(qrData);

    // Deactivate any previous active session for the same class
    await Session.updateMany({ class: classId, isActive: true }, { $set: { isActive: false } });

    // Save session to database
    const session = await Session.create({
      sessionId,
      class: classId,
      teacher: teacherId,
      qrCode,
      lectureTiming,
      expiresAt,
      isActive: true,       // ✅ IMPORTANT FIX
    });

    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      qrCode: session.qrCode,
      lectureTiming: session.lectureTiming,
      expiresAt: session.expiresAt,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ----------------------------------------------------
   Get the active session for a class
---------------------------------------------------- */
const getActiveSession = async (req, res) => {
  const { classId } = req.params;

  try {
    let session = await Session.findOne({
      class: classId,
      isActive: true,
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({ message: "No active session found" });
    }

    // If expired → disable it automatically
    if (session.expiresAt < Date.now()) {
      session.isActive = false;
      await session.save();
      return res.status(400).json({ message: "Session expired" });
    }

    res.json(session);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ----------------------------------------------------
   End session manually (Teacher)
---------------------------------------------------- */
const endSession = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await Session.findOneAndUpdate(
      { sessionId },             // FIXED: We use custom sessionId, not _id
      { isActive: false },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json({
      success: true,
      message: "Session ended successfully",
      session,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateSessionQR,
  getActiveSession,
  endSession,
};
