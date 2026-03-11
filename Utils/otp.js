import crypto from 'crypto';
import twilio from 'twilio';
import nodemailer from 'nodemailer';

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// OTP Configuration
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Generate OTP
export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Store OTP with expiry
export const storeOTP = (identifier, otp) => {
  otpStore.set(identifier, {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY,
    attempts: 0
  });
};

// Verify OTP
export const verifyOTP = (identifier, otp) => {
  const stored = otpStore.get(identifier);
  
  if (!stored) {
    return { success: false, message: 'OTP not found or expired' };
  }
  
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(identifier);
    return { success: false, message: 'OTP has expired' };
  }
  
  if (stored.attempts >= 3) {
    otpStore.delete(identifier);
    return { success: false, message: 'Too many failed attempts' };
  }
  
  if (stored.otp !== otp) {
    stored.attempts++;
    return { success: false, message: 'Invalid OTP' };
  }
  
  otpStore.delete(identifier);
  return { success: true, message: 'OTP verified successfully' };
};

// ========== EMAIL OTP (Nodemailer) ==========
export const sendEmailOTP = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP - Headache Management System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            Password Reset Request
          </h2>
          <p style="font-size: 16px; color: #374151;">
            You requested to reset your password. Use the OTP below:
          </p>
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px; margin: 20px 0;">
            <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Your OTP Code</p>
              <h1 style="margin: 10px 0; font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #1e293b;">
                ${otp}
              </h1>
            </div>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            ⏱️ This OTP is valid for <strong>5 minutes</strong>.
          </p>
          <p style="color: #ef4444; font-size: 13px; background: #fee2e2; padding: 10px; border-radius: 6px;">
            🔒 If you didn't request this, please ignore this email and contact support immediately.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Headache Management System - Secure Medical Portal
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'OTP sent to email' };
  } catch (error) {
    console.error('Email OTP Error:', error);
    return { success: false, message: 'Failed to send email OTP' };
  }
};

// ========== SMS OTP (Twilio) - Optional ==========
export const sendSMSOTP = async (phoneNumber, otp) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    
    if (!accountSid || !authToken || !twilioPhone) {
      console.log('Twilio not configured, skipping SMS');
      return { success: false, message: 'SMS service not configured' };
    }
    
    const client = twilio(accountSid, authToken);
    
    await client.messages.create({
      body: `Your Headache Management System password reset OTP is: ${otp}. Valid for 5 minutes.`,
      from: twilioPhone,
      to: phoneNumber
    });
    
    return { success: true, message: 'OTP sent to mobile number' };
  } catch (error) {
    console.error('SMS OTP Error:', error);
    return { success: false, message: 'Failed to send SMS OTP' };
  }
};

// ========== WELCOME EMAIL (New Doctor Account) ==========
export const sendWelcomeEmail = async (email, username, password) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: `"Headache Management System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Your Doctor Account Has Been Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 10px;">
            Welcome to the Headache Management System!
          </h2>
          <p style="font-size: 16px; color: #374151;">
            Hi <strong>${username}</strong>,
          </p>
          <p style="color: #374151;">
            Your doctor account has been successfully created by the administrator. 
            You can now log in using the credentials below.
          </p>

          <div style="background: #f0f9ff; border-left: 4px solid #0891b2; padding: 20px; margin: 24px 0; border-radius: 6px;">
            <p style="margin: 0 0 12px 0; font-weight: bold; color: #0891b2;">Your Login Credentials</p>
            <p style="margin: 0 0 8px 0; color: #374151;">
              📧 <strong>Email (Username):</strong> ${email}
            </p>
            <p style="margin: 0; color: #374151;">
              🔑 <strong>Password:</strong> 
              <span style="font-size: 20px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">${password}</span>
            </p>
          </div>

          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 14px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; color: #dc2626; font-size: 13px;">
              ⚠️ <strong>Important:</strong> This is a temporary password. Please log in and change it immediately from your profile settings.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Headache Management System — Secure Medical Portal
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Welcome email sent' };
  } catch (error) {
    console.error('Welcome email error:', error);
    return { success: false, message: error.message };
  }
};