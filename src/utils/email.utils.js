import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* eslint no-undef: off */
export const sendOTPEmail = async (email, otp) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify your Email',
    text: `Your OTP for email verification is: ${otp}. It will expire in 10 minutes.`,
  });
};

export const sendEmail = async ({ to, subject, text }) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  };

  return transporter.sendMail(mailOptions);
};
