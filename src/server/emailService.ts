import crypto from 'node:crypto';
import { OnboardingEmailLog } from '../lib/types';

export interface StudentOnboardingPayload {
  institutionName: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  batchLabel: string;
  appBaseUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateTemporaryPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const bytes = crypto.randomBytes(8);
  return `CP-${letters[bytes[0] % letters.length]}${letters[bytes[1] % letters.length]}${digits[bytes[2] % digits.length]}${digits[bytes[3] % digits.length]}-${letters[bytes[4] % letters.length]}${digits[bytes[5] % digits.length]}`;
}

export async function sendStudentCredentials(
  payload: StudentOnboardingPayload
): Promise<OnboardingEmailLog> {
  const temporaryPassword = generateTemporaryPassword();
  const activationToken = crypto.randomBytes(12).toString('hex');
  const baseUrl = (payload.appBaseUrl || process.env.APP_URL || '').replace(/\/$/, '');
  const activationLink = `${baseUrl || ''}/?activate=${activationToken}`;

  const safeInstitution = escapeHtml(payload.institutionName);
  const safeName = escapeHtml(`${payload.firstName} ${payload.lastName}`);
  const safeRoll = escapeHtml(payload.rollNumber);
  const safeBatch = escapeHtml(payload.batchLabel);
  const safePass = escapeHtml(temporaryPassword);
  const safeLink = escapeHtml(activationLink);

  const subject = `[${payload.institutionName}] Your CampusPulse Student Portal Credentials`;
  const htmlPreview = [
    `Hello ${safeName},`,
    ``,
    `Your student attendance portal account at ${safeInstitution} (${safeBatch}) is ready.`,
    ``,
    `Student Roll No: ${safeRoll}`,
    `Portal Email: ${escapeHtml(payload.email)}`,
    `Temporary Password: ${safePass}`,
    `Activation Link: ${safeLink}`,
    ``,
    `Sign in to monitor your real-time attendance, 75% recovery predictor, and monthly lecture heatmap.`,
  ].join('\n');

  let deliveryMode: 'RESEND_LIVE' | 'LOCAL_QUEUE' = 'LOCAL_QUEUE';
  let status: 'DELIVERED' | 'QUEUED' = 'DELIVERED';

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const from = process.env.EMAIL_FROM || 'CampusPulse <onboarding@campuspulse.edu>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [payload.email],
          subject,
          text: htmlPreview,
        }),
      });
      if (response.ok) {
        deliveryMode = 'RESEND_LIVE';
        status = 'DELIVERED';
      } else {
        deliveryMode = 'LOCAL_QUEUE';
        status = 'QUEUED';
      }
    } catch {
      deliveryMode = 'LOCAL_QUEUE';
      status = 'QUEUED';
    }
  }

  return {
    id: `mail-${crypto.randomUUID().slice(0, 8)}`,
    studentId: payload.studentId,
    studentName: `${payload.firstName} ${payload.lastName}`,
    rollNumber: payload.rollNumber,
    recipientEmail: payload.email,
    temporaryPassword,
    activationToken,
    activationLink,
    deliveryMode,
    status,
    subject,
    htmlPreview,
    sentAt: new Date().toISOString(),
  };
}
