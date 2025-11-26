import nodemailer from 'nodemailer';

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const getTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  if (!emailUser || !emailPassword) {
    throw new Error('EMAIL_USER and EMAIL_PASSWORD environment variables are required');
  }

  return nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

export const sendOtpEmail = async (email: string, otp: string) => {
  const emailUser = process.env.EMAIL_USER;
  
  if (!emailUser) {
    throw new Error('EMAIL_USER environment variable is required');
  }
  const mailOptions = {
    from: emailUser,
    to: email,
    subject: 'OTP Verification',
    text: `Your OTP is ${otp}`,
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully');
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

export const sendActivationEmail = async (email: string, fullName: string, activationLink: string) => {
    const emailUser = process.env.EMAIL_USER;
    
    if (!emailUser) {
        throw new Error('EMAIL_USER environment variable is required');
    }

    const mailOptions = {
        from: emailUser,
        to: email,
        subject: "Activate Your Account",
        html: `
            <p>Hello ${fullName},</p>
            <p>Your account has been created. Please activate your account by setting up a password.</p>
            <p><a href="${activationLink}">Click here to activate your account</a></p>
            <p>The link will expire in 1 hour.</p>
        `,
    };

    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
};

export const sendResetPasswordEmail = async (email: string, fullName: string, resetPasswordLink: string) => {
  const emailUser = process.env.EMAIL_USER;
  
  if (!emailUser) {
    throw new Error('EMAIL_USER environment variable is required');
  }

  const mailOptions = {
      from: emailUser,
      to: email,
      subject: "Reset Your Account Password",
      html: `
          <p>Hi ${fullName},</p>
          <p>We received a request to reset your password. Click the link below to set up a new one:</p>
          <p><a href="${resetPasswordLink}">Reset Password</a></p>
          <p>This link is valid for the next 60 minutes.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>Best regards,</p>
          <p>Your Support Team</p>
      `,
  };

  const transporter = getTransporter();
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending reset password email:', error);
    throw error;
  }
};