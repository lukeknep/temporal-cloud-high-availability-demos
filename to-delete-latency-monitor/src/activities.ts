// src/activities.ts
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import { loadConfig } from './config';

export interface PingOnceInput {
  url: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

/**
 * Ping a URL once and return latency in milliseconds.
 * We measure wall-clock duration regardless of HTTP status code.
 */
export async function pingOnce({ url }: PingOnceInput): Promise<number> {
  const start = process.hrtime.bigint();

  try {
    const response = await fetch(url, {
      method: 'GET',
    });

    // Drain body (not strictly required, but keeps things tidy)
    // Ignore any errors in reading body
    try {
      await response.text();
    } catch {
      // ignore
    }
  } catch {
    // Even on network error, we still measure latency
  }

  const end = process.hrtime.bigint();
  const diffNs = Number(end - start); // nanoseconds
  const ms = diffNs / 1e6; // convert to milliseconds

  return ms;
}

/**
 * Send an email via Gmail SMTP.
 * Use an App Password for SMTP_PASS and a Gmail address in SMTP_USER.
 */
const { smtp } = loadConfig();

const transporter = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.secure,
  auth: {
    user: smtp.user,
    pass: smtp.pass,
  },
});

export async function sendEmail({ to, subject, body }: SendEmailInput): Promise<void> {
  await transporter.sendMail({
    from: smtp.from,
    to,
    subject,
    text: body,
  });
}