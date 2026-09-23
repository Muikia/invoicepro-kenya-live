function isEmailConfigured() {
  return Boolean(
    (process.env.SMTP_HOST && process.env.SMTP_USER) || String(process.env.RESEND_API_KEY || '').trim()
  );
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'InvoicePro <noreply@invoicepro.example.com>';

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_PORT || '587') === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || '',
      },
    });
    await transporter.sendMail({ from, to, subject, html, text });
    return { sent: true };
  }

  if (!apiKey) {
    console.log('[email:dev]', { to, subject, text: text || html });
    return { sent: false, logged: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[email] Resend failed', response.status, body);
    const error = new Error('Could not send email. Try again later.');
    error.status = 502;
    throw error;
  }

  return { sent: true };
}

async function sendPasswordResetEmail(to, resetUrl) {
  return sendEmail({
    to,
    subject: 'Reset your InvoicePro password',
    text: `Reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
    html: `
      <p>You asked to reset your InvoicePro password.</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
  });
}

async function sendVerificationEmail(to, name, code) {
  return sendEmail({
    to,
    subject: 'Verify Your InvoicePro Account',
    text: `Hi ${name},\n\nWelcome to InvoicePro Kenya!\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you didn't sign up for InvoicePro, ignore this email.\n\n—\nInvoicePro Kenya\nsupport@invoicepro.com`,
    html: `
      <p>Hi ${name},</p>
      <p>Welcome to InvoicePro Kenya!</p>
      <p>Your verification code is:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:700;border:1px solid #ddd;display:inline-block;padding:12px 20px;">${code}</p>
      <p>This code expires in 15 minutes.</p>
      <p>If you didn't sign up for InvoicePro, ignore this email.</p>
      <p>—<br/>InvoicePro Kenya<br/>support@invoicepro.com</p>
    `,
  });
}

async function sendAccountDeletedEmail(to, name) {
  return sendEmail({
    to,
    subject: 'Your InvoicePro Account Has Been Deleted',
    text: `Hi ${name},\n\nYour InvoicePro account has been permanently deleted.\n\nAll your data (invoices, customers, settings) has been removed.\n\nIf you did not request this, please contact support immediately at support@invoicepro.com\n\n—\nInvoicePro Kenya`,
    html: `
      <p>Hi ${name},</p>
      <p>Your InvoicePro account has been permanently deleted.</p>
      <p>All your data (invoices, customers, settings) has been removed.</p>
      <p>If you did not request this, please contact support immediately at support@invoicepro.com</p>
      <p>—<br/>InvoicePro Kenya</p>
    `,
  });
}

module.exports = {
  isEmailConfigured,
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendAccountDeletedEmail,
};
