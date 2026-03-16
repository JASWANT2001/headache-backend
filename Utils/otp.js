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
      from: `"Headache Compass" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Your Password Reset Code',
      attachments: [
        {
          filename: "Headache_Compass_Doctor_User_Guide.pdf",
          path: "./docs/headache_compass_doctor_user_guide.pdf"
        }
      ],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);">
          <div style="padding: 40px 20px; min-height: 100vh;">
            <div style="max-width: 520px; margin: 0 auto;">
             
              <!-- Header with Logo -->
              <div style="text-align: center; margin-bottom: 40px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; border-radius: 50px; font-weight: 600; font-size: 14px; letter-spacing: 1px;">
                  🏥 HEADACHE COMPASS
                </div>
              </div>


              <!-- Main Card -->
              <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08); border: 1px solid #f0f0f0;">
               
                <!-- Header Section -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px 40px; text-align: center;">
                  <div style="margin-bottom: 16px; font-size: 48px;">🔐</div>
                  <h1 style="margin: 0 0 12px 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                    Password Reset Code
                  </h1>
                  <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 15px; line-height: 1.6; font-weight: 400;">
                    Enter this code to securely reset your password
                  </p>
                </div>


                <!-- Content Section -->
                <div style="padding: 48px 40px;">
                  <!-- OTP Display -->
                  <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%); border: 2px solid #667eea; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
                    <p style="margin: 0 0 16px 0; color: #667eea; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                      Your One-Time Code
                    </p>
                    <div style="font-family: 'Courier New', monospace; font-size: 48px; font-weight: 700; color: #2d3748; letter-spacing: 12px; margin: 0; word-spacing: 12px;">
                      ${otp}
                    </div>
                    <p style="margin: 20px 0 0 0; color: #718096; font-size: 13px;">
                      Valid for <strong style="color: #667eea;">5 minutes</strong>
                    </p>
                  </div>


                  <!-- Security Note -->
                  <div style="background: #f8f9fa; border-left: 4px solid #667eea; border-radius: 8px; padding: 20px; margin-bottom: 32px;">
                    <p style="margin: 0; color: #2d3748; font-size: 14px; line-height: 1.7;">
                      <strong>Keep this code private.</strong> Never share it with anyone. Our staff will never ask for your code.
                    </p>
                  </div>


                  <!-- Warning Box -->
                  <div style="background: #fff5f5; border-left: 4px solid #fc8181; border-radius: 8px; padding: 20px; margin-bottom: 32px;">
                    <p style="margin: 0; color: #742a2a; font-size: 13px; line-height: 1.6;">
                      <strong>Didn't request this?</strong> Ignore this email and your account remains secure. If you notice unusual activity, contact support immediately.
                    </p>
                  </div>


                  <!-- Information Box -->
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <p style="margin: 0 0 12px 0; color: #2d3748; font-size: 14px; font-weight: 600;">Why am I getting this?</p>
                    <p style="margin: 0; color: #718096; font-size: 13px; line-height: 1.7;">
                      A password reset was requested for your Headache Compass account. If this wasn't you, your account may be at risk. Change your password immediately or contact support.
                    </p>
                  </div>
                </div>


                <!-- Footer Section -->
                <div style="background: #f8f9fa; border-top: 1px solid #e2e8f0; padding: 32px 40px;">
                  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <p style="margin: 0 0 16px 0; color: #2d3748; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      👨‍⚕️ Medical Professional
                    </p>
                    <div style="border-left: 3px solid #667eea; padding-left: 16px;">
                      <p style="margin: 0 0 8px 0; color: #2d3748; font-size: 13px; font-weight: 600;">
                        Dr. Prasanna Vani V
                      </p>
                      <p style="margin: 0 0 8px 0; color: #718096; font-size: 12px;">
                        <strong>Specialist:</strong> Consultant in Pain Medicine
                      </p>
                      <p style="margin: 0 0 8px 0; color: #718096; font-size: 12px;">
                        M.D., F.I.P.M., E.D.P.M (Part 1), C.C.E.P.
                      </p>
                      <p style="margin: 0 0 8px 0; color: #718096; font-size: 12px;">
                        JP Neuro Spine Hospital, Krishnagiri
                      </p>
                      <p style="margin: 0 0 4px 0; color: #718096; font-size: 12px;">
                        📞 <strong>8754870054</strong>
                      </p>
                      <p style="margin: 0; color: #718096; font-size: 12px;">
                        ✉️ drprasannavaniv@gmail.com
                      </p>
                    </div>
                  </div>


                  <p style="margin: 0; color: #a0aec0; font-size: 11px; text-align: center; line-height: 1.6;">
                    © 2024 Headache Compass | Secure Medical Portal<br>
                    This is an automated message. Please do not reply to this email.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
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
      from: `"Headache Compass" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Welcome to Headache Compass - Your Doctor Account is Ready',
      attachments: [
        {
          filename: "Headache_Compass_Doctor_User_Guide.pdf",
          path: "./docs/headache_compass_doctor_user_guide.pdf"
        }
      ],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);">
          <div style="padding: 40px 20px; min-height: 100vh;">
            <div style="max-width: 520px; margin: 0 auto;">
             
              <!-- Header with Logo -->
              <div style="text-align: center; margin-bottom: 40px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 32px; border-radius: 50px; font-weight: 600; font-size: 14px; letter-spacing: 1px;">
                  🏥 HEADACHE COMPASS
                </div>
              </div>


              <!-- Main Card -->
              <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08); border: 1px solid #f0f0f0;">
               
                <!-- Header Section -->
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 48px 40px 40px; text-align: center;">
                  <div style="margin-bottom: 16px; font-size: 52px;">🎉</div>
                  <h1 style="margin: 0 0 12px 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                    Account Ready!
                  </h1>
                  <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 15px; line-height: 1.6; font-weight: 400;">
                    Welcome to Headache Compass, <strong>${username}</strong>
                  </p>
                </div>


                <!-- Content Section -->
                <div style="padding: 48px 40px;">
                 
                  <!-- SECTION 1: Initial Welcome Message -->
                  <div style="margin-bottom: 40px;">
                    <p style="margin: 0; color: #2d3748; font-size: 15px; line-height: 1.8; font-weight: 500;">
                      Dear <strong>${username}</strong>,
                    </p>
                    <p style="margin: 16px 0 0 0; color: #2d3748; font-size: 15px; line-height: 1.8;">
                      Your doctor account has been successfully created and is now <strong>ready to use</strong>. You have full access to the Headache Compass clinical platform to manage patient cases, assessments, and medical documentation.
                    </p>
                  </div>


                  <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 0 0 40px 0;">


                  <!-- SECTION 2: Login Credentials -->
                  <div style="margin-bottom: 40px;">
                    <h3 style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; font-weight: 700; letter-spacing: -0.3px;">
                      🔑 Login Credentials
                    </h3>
                   
                    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px solid #10b981; border-radius: 12px; padding: 28px;">
                     
                      <!-- Email -->
                      <div style="margin-bottom: 24px;">
                        <p style="margin: 0 0 8px 0; color: #059669; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                          Email / Username
                        </p>
                        <p style="margin: 0; color: #2d3748; font-size: 15px; font-weight: 600; word-break: break-all; background: #ffffff; padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2);">
                          ${email}
                        </p>
                      </div>


                      <!-- Password -->
                      <div>
                        <p style="margin: 0 0 8px 0; color: #059669; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                          Temporary Password
                        </p>
                        <div style="background: #ffffff; border: 2px solid #10b981; border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; text-align: center;">
                          <p style="margin: 0; color: #2d3748; font-size: 26px; font-weight: 700; letter-spacing: 6px;">
                            ${password}
                          </p>
                        </div>
                      </div>
                    </div>


                    <!-- Security Notice -->
                   
                  </div>


                  <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 0 0 40px 0;">


                  <!-- SECTION 3: Sign In Button -->
                  <div style="text-align: center; margin-bottom: 40px;">
                    <a href="https://www.drprasannavani.com/login" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); border: none; cursor: pointer;">
                      → Sign In to Headache Compass
                    </a>
                    <p style="margin: 16px 0 0 0; color: #718096; font-size: 12px;">
                      Access the platform using the credentials above
                    </p>
                  </div>


                  <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 0 0 40px 0;">


                  <!-- SECTION 4: Platform Lead Information -->
                  <div style="margin-bottom: 40px;">
                    <h3 style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; font-weight: 700; letter-spacing: -0.3px;">
                      👨‍⚕️ Platform Lead
                    </h3>
                    <div style="background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; border-left: 4px solid #10b981;">
                      <p style="margin: 0 0 12px 0; color: #2d3748; font-size: 14px; font-weight: 700;">
                        Dr. Prasanna Vani V
                      </p>
                      <div style="color: #718096; font-size: 13px; line-height: 1.8;">
                        <p style="margin: 0 0 6px 0;">
                          <strong>Specialist:</strong> Consultant in Pain Medicine
                        </p>
                        <p style="margin: 0 0 6px 0;">
                          M.D., F.I.P.M., E.D.P.M (Part 1), C.C.E.P.
                        </p>
                        <p style="margin: 0 0 6px 0;">
                          JP Neuro Spine Hospital, Krishnagiri
                        </p>
                        <p style="margin: 0 0 4px 0;">
                          📞 <strong>8754870054</strong>
                        </p>
                        <p style="margin: 0;">
                          ✉️ drprasannavaniv@gmail.com
                        </p>
                      </div>
                    </div>
                  </div>


                  <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 0 0 40px 0;">


                  <!-- SECTION 5: PDF Attachment Notice -->
                  <div style="background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 12px 0; color: #065f46; font-size: 14px; font-weight: 700;">
                      📎 User Guide Attached
                    </p>
                    <p style="margin: 0; color: #065f46; font-size: 13px; line-height: 1.7;">
                      A comprehensive <strong>Doctor User Guide</strong> is attached to this email. Please review it thoroughly to understand all features, workflows, and best practices for using the Headache Compass platform.
                    </p>
                  </div>


                </div>


                <!-- Footer Section -->
                <div style="background: #f8f9fa; border-top: 1px solid #e2e8f0; padding: 32px 40px;">
                 
                  <p style="margin: 0; color: #a0aec0; font-size: 11px; text-align: center; line-height: 1.6;">
                    © 2026 Headache Compass | Secure Medical Portal<br>
                    This is an automated message. Please do not reply to this email.
                  </p>
                </div>
              </div>


              <!-- Support Note -->
              <div style="text-align: center; margin-top: 24px;">
                <p style="margin: 0; color: #718096; font-size: 12px;">
                  Need help? Contact support or refer to the Doctor User Guide attached to this email.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };


    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Welcome email sent' };
  } catch (error) {
    console.error('Welcome email error:', error);
    return { success: false, message: error.message };
  }
};



