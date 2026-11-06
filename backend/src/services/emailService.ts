import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

interface EtherealAccount {
  user: string;
  pass: string;
  transporter: Transporter;
}

// Cache of sender → Ethereal account (creates one per unique sender)
const senderAccounts = new Map<string, EtherealAccount>();

/**
 * Get or create an SMTP transporter for a given sender email.
 * If SMTP_USER & SMTP_PASS are set in backend/.env, uses real SMTP (e.g. Gmail / SendGrid / Custom).
 * Otherwise falls back to Ethereal sandbox for safe testing with preview links.
 */
async function getTransporterForSender(senderEmail: string): Promise<{ transporter: Transporter; from: string; isReal: boolean }> {
  const realSmtpUser = process.env.SMTP_USER;
  const realSmtpPass = process.env.SMTP_PASS;

  if (realSmtpUser && realSmtpPass) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465');
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : (port === 465);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: realSmtpUser,
        pass: realSmtpPass,
      },
    });

    console.log(`🚀 Using REAL SMTP (${host}:${port}) for sender ${senderEmail} via ${realSmtpUser}`);
    return {
      transporter,
      from: `"${senderEmail.split('@')[0]}" <${realSmtpUser}>`,
      isReal: true,
    };
  }

  if (senderAccounts.has(senderEmail)) {
    const account = senderAccounts.get(senderEmail)!;
    return { transporter: account.transporter, from: `${senderEmail} <${account.user}>`, isReal: false };
  }

  // Create a new Ethereal test account
  const testAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  senderAccounts.set(senderEmail, {
    user: testAccount.user,
    pass: testAccount.pass,
    transporter,
  });

  console.log(`📧 Created Ethereal test account for ${senderEmail}: ${testAccount.user} (Mock Sandbox)`);

  return { transporter, from: `${senderEmail} <${testAccount.user}>`, isReal: false };
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string;
  accepted: string[];
  isReal: boolean;
}

/**
 * Send a single email via configured SMTP (Real SMTP or Ethereal sandbox)
 */
export async function sendEmail(params: {
  sender: string;
  to: string;
  subject: string;
  body: string;
}): Promise<SendEmailResult> {
  const { transporter, from, isReal } = await getTransporterForSender(params.sender);

  const info = await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">${params.body.replace(/\n/g, '<br>')}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || (isReal ? 'REAL_EMAIL_DELIVERED' : '');

  console.log(`📤 Email sent to ${params.to} | Mode: ${isReal ? 'REAL SMTP' : 'Ethereal Test'} | Result: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl,
    accepted: info.accepted as string[],
    isReal,
  };
}

/**
 * Sleep utility for enforcing minimum delay between sends
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
