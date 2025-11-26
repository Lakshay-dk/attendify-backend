const express = require('express');
const { registerUser, authUser } = require('../controllers/authController');
const { body } = require('express-validator');

const router = express.Router();

// -----------------------------
// TEST ROUTE (Very useful on Render)
// -----------------------------
router.get("/test", (req, res) => {
  res.json({
    status: "OK",
    message: "Auth route working ✔️",
  });
});

// -----------------------------
// REGISTER ROUTE
// -----------------------------
router.post(
  '/register',
  [
    body('name', 'Name is required').notEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters')
      .isLength({ min: 6 }),
  ],
  registerUser
);

// -----------------------------
// LOGIN ROUTE
// -----------------------------
router.post('/login', authUser);

module.exports = router;
