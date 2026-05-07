import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@techteg.com';

export async function sendMail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`[MAIL] Would send to=${to} subject="${subject}" body=${html.slice(0, 100)}...`);
    return;
  }

  try {
    await t.sendMail({ from: FROM_ADDRESS, to, subject, html });
    console.log(`[MAIL] Sent to=${to} subject="${subject}"`);
  } catch (err) {
    console.error(`[MAIL] Failed to send to=${to}:`, err);
  }
}

export function buildVerifyEmailHtml(token: string): string {
  const url = `${process.env.SYSTEM_URL || 'https://www.techteg.com'}/verify-email?token=${token}`;
  return `
    <h2>Verify Your Email</h2>
    <p>Click the link below to verify your email address:</p>
    <p><a href="${url}">${url}</a></p>
    <p>This link expires in 24 hours.</p>
  `;
}

export function buildCommentReplyHtml(replyerName: string, articleSlug: string, preview: string): string {
  const url = `${process.env.SYSTEM_URL || 'https://www.techteg.com'}/article/${articleSlug}`;
  return `
    <h2>New Reply to Your Comment</h2>
    <p><strong>${replyerName}</strong> replied to your comment on <a href="${url}">this article</a>.</p>
    <blockquote style="border-left:3px solid #ddd;padding:8px 16px;color:#555">${preview}</blockquote>
  `;
}

export function buildNewCommentHtml(commenterName: string, articleSlug: string, articleTitle: string): string {
  const url = `${process.env.SYSTEM_URL || 'https://www.techteg.com'}/article/${articleSlug}`;
  return `
    <h2>New Comment on Your Article</h2>
    <p><strong>${commenterName}</strong> commented on your article <a href="${url}">${articleTitle}</a>.</p>
  `;
}
