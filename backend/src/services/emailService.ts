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
 * Get or create an Ethereal test account for a given sender email
 * In production this would be a real SMTP config per sender
 */
async function getTransporterForSender(senderEmail: string): Promise<{ transporter: Transporter; from: string }> {
  if (senderAccounts.has(senderEmail)) {
    const account = senderAccounts.get(senderEmail)!;
    return { transporter: account.transporter, from: `${senderEmail} <${account.user}>` };
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

  console.log(`📧 Created Ethereal account for sender ${senderEmail}: ${testAccount.user}`);

  return { transporter, from: `${senderEmail} <${testAccount.user}>` };
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string;
  accepted: string[];
}

/**
 * Send a single email via Ethereal SMTP
 */
export async function sendEmail(params: {
  sender: string;
  to: string;
  subject: string;
  body: string;
}): Promise<SendEmailResult> {
  const { transporter, from } = await getTransporterForSender(params.sender);

  const info = await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">${params.body.replace(/\n/g, '<br>')}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || '';

  console.log(`📤 Email sent to ${params.to} | Preview: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl,
    accepted: info.accepted as string[],
  };
}

/**
 * Sleep utility for enforcing minimum delay between sends
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
