// The look shared by every email. Tables and inline styles only: mail clients
// (Outlook, Gmail) ignore flexbox, gradients with blur and external CSS.
const BRAND_COLOR = '#612AD5';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// A button that renders in Outlook too (a table cell with the background)
export const emailButton = (url: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
  <tr>
    <td align="center" bgcolor="${BRAND_COLOR}" style="border-radius: 8px;">
      <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${escapeHtml(
        label
      )}</a>
    </td>
  </tr>
</table>
<p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">If the button does not work, copy this link into your browser:<br /><a href="${url}" style="color: ${BRAND_COLOR}; word-break: break-all;">${url}</a></p>`;

export const emailLayout = (params: {
  subject: string;
  html: string;
  brand: string;
  frontendUrl: string;
}) => {
  const { subject, html, brand, frontendUrl } = params;
  const preheader = escapeHtml(
    html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110)
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(subject)}</title>
  <style>
    a { color: ${BRAND_COLOR}; }
    @media (max-width: 620px) { .card { padding: 24px 20px !important; } }
    @media (prefers-color-scheme: dark) {
      body, .page { background-color: #0f1117 !important; }
      .card { background-color: #1a1d27 !important; }
      .title, .brand { color: #f3f4f6 !important; }
      .content, .content p { color: #d1d5db !important; }
      .footer, .footer a { color: #9ca3af !important; }
      .rule { border-top-color: #2a2e3a !important; }
      .content a, .card a { color: #a78bfa !important; }
      .footer a { color: #9ca3af !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fb;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>
  <table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6fb;">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
          <tr>
            <td class="brand" style="padding: 0 4px 16px; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #111827;">
              <span style="color: ${BRAND_COLOR};">&#9679;</span>&nbsp;${escapeHtml(brand)}
            </td>
          </tr>
          <tr>
            <td class="card" style="background-color: #ffffff; border-radius: 12px; padding: 32px 36px; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <h1 class="title" style="margin: 0 0 20px; font-size: 24px; line-height: 1.3; font-weight: 700; color: #111827;">${escapeHtml(
                subject
              )}</h1>
              <div class="content" style="font-size: 16px; line-height: 1.6; color: #374151;">
                ${html}
              </div>
              <div class="rule" style="margin-top: 28px; border-top: 1px solid #e5e7eb;"></div>
              <p class="footer" style="margin: 16px 0 0; font-size: 12px; line-height: 1.5; color: #6b7280;">
                You can change which emails you get in your <a href="${frontendUrl}/settings" style="color: #6b7280;">account settings</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer" style="padding: 16px 4px 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #9ca3af;">
              ${escapeHtml(brand)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
