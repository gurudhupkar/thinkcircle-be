import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
})

// export async function sendOtpEmail(to: string, otp: string) {
//   const mailOptions = {
//     from: `"Brainly" ${process.env.MAIL_USER}`,
//     to,
//     subject: "Your OTP for password reset",
//     html: `<p>Your OTP is: <b>${otp}</b>. It will expire in 10 minutes.</p>`
//   }
//   await transporter.sendMail(mailOptions)
// }

export async function sendPasswordResetLink(to: string, token: string) {
  const resetUrl = `http://localhost:3001/reset-password/${token}`

  const mailOptions = {
    from: `"Brainly" <${process.env.MAIL_USER}>`,
    to,
    subject: "Reset your password",
    html: `
      <p>You requested a password reset.</p>
      <p>Click this link to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 30 minutes.</p>
    `
  }
  await transporter.sendMail(mailOptions)
}
