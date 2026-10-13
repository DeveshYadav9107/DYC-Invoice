// ─────────────────────────────────────────────────────────────────
// Email Service — Nodemailer SMTP integration for OTP delivery
// ─────────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';
import { checkSmtpConfig } from '@/lib/env';

/**
 * Creates a Nodemailer transport instance using environment settings.
 */
function createTransporter() {
  const { configured } = checkSmtpConfig();

  if (!configured) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Generates responsive HTML email template for OTP code.
 */
function getOtpHtmlTemplate(code) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your InvoiceFlow Verification Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">InvoiceFlow</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">AI-Powered Invoice Verification & Export</p>
        </div>
        <div style="padding: 36px 32px; text-align: center;">
          <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin: 0 0 12px;">Your Verification Code</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
            Enter the 6-digit code below to securely sign in to your InvoiceFlow account. This code expires in 10 minutes.
          </p>
          <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 28px; display: inline-block; letter-spacing: 10px; font-size: 34px; font-weight: 800; color: #0284c7; font-family: monospace;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
            If you did not request this verification code, please ignore this email. No action is required.
          </p>
        </div>
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; color: #94a3b8; font-size: 11px;">
          © ${new Date().getFullYear()} InvoiceFlow. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sends an OTP email to the user.
 * If SMTP is not yet configured in local development, logs code to console.
 */
export async function sendOtpEmail(toEmail, code) {
  const { configured, missing } = checkSmtpConfig();

  if (!configured) {
    // In local development before SMTP is provided, log to console so auth works seamlessly
    console.warn('\n⚠️ [InvoiceFlow Auth] SMTP is not fully configured (missing: ' + missing.join(', ') + ').');
    console.info(`📧 [InvoiceFlow Auth Dev Code] OTP for ${toEmail}: >>> ${code} <<<\n`);

    return {
      success: true,
      delivered: false,
      devMode: true,
      message: 'SMTP credentials missing. Verification code logged to development console.',
    };
  }

  const transporter = createTransporter();
  const mailOptions = {
    from: process.env.SMTP_FROM || 'InvoiceFlow <noreply@invoiceflow.app>',
    to: toEmail,
    subject: `${code} is your InvoiceFlow verification code`,
    text: `Your InvoiceFlow verification code is: ${code}\nThis code expires in 10 minutes.\nIf you did not request this code, please ignore this email.`,
    html: getOtpHtmlTemplate(code),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      delivered: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error('Failed to send OTP email via SMTP:', err);
    throw new Error('Failed to deliver email. Please check SMTP configuration.');
  }
}
