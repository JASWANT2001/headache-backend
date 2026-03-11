import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { auth } from './middleware.js';
import { generateOTP, storeOTP, verifyOTP, sendSMSOTP, sendEmailOTP, sendWelcomeEmail } from '../Utils/Otp.js'

dotenv.config();
const router = express.Router();

// Helper function to generate user ID
const generateUserId = () => {
  return `USR-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// ADMIN LOGIN
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email === process.env.SUPER_ADMIN_EMAIL && password === process.env.SUPER_ADMIN_PASSWORD) {
      const token = generateToken('admin-001', 'admin');
      return res.json({
        success: true,
        token,
        user: {
          id: 'admin-001',
          email,
          role: 'admin',
          username: 'Super Admin'
        }
      });
    }
    
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// USER LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();
    
    const token = generateToken(user._id, user.role);
    
    res.json({
      success: true,
      token,
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET CURRENT USER
router.get('/me', auth, async (req, res) => {
  try {
    // If logged in user is Super Admin
    if (req.role === 'admin') {
      return res.json({
        success: true,
        data: {
          id: 'admin-001',
          email: process.env.SUPER_ADMIN_EMAIL,
          role: 'admin',
          username: 'Super Admin'
        }
      });
    }

    // For normal users
    const user = await User.findById(req.userId);
    res.json({ success: true, data: user });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE USER (Admin Only)
router.post('/users', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    
  const { username, email, phoneNumber, role, location, district, instituteName, instituteType } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    const password = '1234';
    const userId = generateUserId();
    
 const user = await User.create({
      userId,
      username,
      email,
      phoneNumber,
      password,
      role: role || 'doctor',
      location,
      district,
      instituteName,
      instituteType
    });
    
    sendWelcomeEmail(email, username, password).catch(err => console.error('Welcome email failed:', err));
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: user.toJSON(),
      credentials: {
        email,
        password,
        note: 'Password was auto-generated and should be sent to user'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET ALL USERS (Admin Only)
router.get('/users', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments({ role: { $ne: 'admin' } });
    
    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE USER (Admin Only)
router.put('/users/:userId', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
 const { username, email, phoneNumber, role, location, district, instituteName, instituteType } = req.body;

    // Check if email or username is taken by a DIFFERENT user
    if (email || username) {
      const conflict = await User.findOne({
        _id: { $ne: req.params.userId },
        $or: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : []),
        ],
      });
      if (conflict) {
        return res.status(400).json({ success: false, message: 'Email or username already in use' });
      }
    }

  const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { username, email, phoneNumber, role, location, district, instituteName, instituteType },
      { new: true, runValidators: true, select: '-password' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User updated', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE USER (Admin Only)
router.delete('/users/:userId', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    
    await User.findByIdAndDelete(req.params.userId);
    
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SAVE ASSESSMENT (Doctor Only)
router.post('/assessments', auth, async (req, res) => {
  try {
    const { doctorEmail, patient, assessmentFlow, diagnosis } = req.body;

    const Assessment = (await import('../models/Assessment.js')).default;

    const record = await Assessment.create({
      doctorEmail,
      patient,
      assessmentFlow,
      diagnosis,
      submittedAt: new Date(),
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// RESET PASSWORD (Authenticated Users Only)
router.put('/password/reset', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'New passwords do not match' 
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 4 characters' 
      });
    }

    // Admin cannot reset password this way (optional check)
    if (req.role === 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin password reset not supported' 
      });
    }

    // Get user with password
    const user = await User.findById(req.userId).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ========== FORGOT PASSWORD - REQUEST OTP ==========
router.post('/forgot-password/request', async (req, res) => {
  try {
    const { identifier, method } = req.body;
    
    if (!identifier || !method) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email/Phone and method are required' 
      });
    }
    
    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phoneNumber: identifier }
      ]
    });
    
    if (!user) {
      // Security: Don't reveal if user exists
      return res.json({ 
        success: true, 
        message: 'If the account exists, you will receive an OTP' 
      });
    }
    
    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(identifier, otp);
    
    // Send OTP based on method
    let sendResult;
    if (method === 'sms' && user.phoneNumber) {
      sendResult = await sendSMSOTP(user.phoneNumber, otp);
    } else if (method === 'email' && user.email) {
      sendResult = await sendEmailOTP(user.email, otp);
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid method or contact information not available' 
      });
    }
    
    if (!sendResult.success) {
      return res.status(500).json(sendResult);
    }
    
    res.json({ 
      success: true, 
      message: `OTP sent via ${method}`,
      maskedContact: method === 'sms' 
        ? user.phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
        : user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== FORGOT PASSWORD - VERIFY OTP ==========
router.post('/forgot-password/verify', async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    
    if (!identifier || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Identifier and OTP are required' 
      });
    }
    
    // Verify OTP
    const verification = verifyOTP(identifier, otp);
    
    if (!verification.success) {
      return res.status(400).json(verification);
    }
    
    // Generate temporary reset token (valid for 10 minutes)
    const resetToken = jwt.sign(
      { identifier, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '10m' }
    );
    
    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      resetToken 
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== FORGOT PASSWORD - RESET PASSWORD ==========
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;
    
    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }
    
    if (newPassword.length < 4) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 4 characters' 
      });
    }
    
    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-secret-key');
      
      if (decoded.purpose !== 'password-reset') {
        throw new Error('Invalid token purpose');
      }
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }
    
    // Find and update user
    const user = await User.findOne({
      $or: [
        { email: decoded.identifier },
        { phoneNumber: decoded.identifier }
      ]
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;