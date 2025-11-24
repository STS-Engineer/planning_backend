const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt= require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');


// Middleware to authenticate and extract user from JWT
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("Authorization header missing or invalid");
    return res.status(401).json({ message: 'Authorization token is missing' });
  }

  const token = authHeader.split(' ')[1];
  console.log("Extracted Token:", token);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded Token Payload:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("JWT Verification Error:", error.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Prevent duplicate names
  },
});

// File filter to allow only specific types
const fileFilter = (req, file, cb) => {
  cb(null, true); // Accept all files
};



// Initialize multer
const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 10MB file size limit
});

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


JWT_SECRET='12345'

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare the password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '72h' }
    );

    res.status(200).json({ message: 'Login successful', token, role: user.role , user_id: user.user_id});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});







module.exports = router;
