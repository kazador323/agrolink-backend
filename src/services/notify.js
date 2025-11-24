const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

async function sendEmail(to, subject, html) {
  if (!to) return
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"AgroLink" <no-reply@agrolink.cl>',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('[notify] Error enviando mail', err)
  }
}

module.exports = { sendEmail }
