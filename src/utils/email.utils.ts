import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'priyalgeitpl@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'pgcv cebg pexn sjaz',
  },
});

export const sendOtpEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'priyalgeitpl@gmail.com',
    to: email,
    subject: 'OTP Verification',
    text: `Your OTP is ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully');
  } catch (error) {
    console.error('Error sending OTP email:', error);
  }
};

export const sendActivationEmail = async (email: string, fullName: string, activationLink: string) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Activate Your Account",
        html: `
            <p>Hello ${fullName},</p>
            <p>Your account has been created. Please activate your account by setting up a password.</p>
            <p><a href="${activationLink}">Click here to activate your account</a></p>
            <p>The link will expire in 1 hour.</p>
        `,
    };

    await transporter.sendMail(mailOptions);
};
