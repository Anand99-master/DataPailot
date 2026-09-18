import { SendVerificationEmailOptions, SendPasswordResetEmailOptions } from './types';

/**
 * Escapes HTML entities to prevent injection in email templates.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates HTML and plain text email for email verification.
 */
export function buildVerificationEmail(options: SendVerificationEmailOptions): { subject: string; html: string; text: string } {
  const recipientName = options.name ? escapeHtml(options.name) : 'there';
  const rawUrl = options.verificationUrl;
  const escapedUrl = escapeHtml(rawUrl);

  const subject = 'Verify your email address — DataPilot';

  const text = `DataPilot — Verify Your Email Address

Hello ${options.name || 'there'},

Thank you for creating an account with DataPilot Enterprise Analytics.

To activate your account and unlock full workspace access, please verify your email address by clicking the link below:

${rawUrl}

This verification link will expire in 24 hours.

If you did not create an account on DataPilot, you can safely ignore this email. No further action is required.

—
DataPilot Enterprise Analytics Platform
https://datapilot.io
Support: support@datapilot.io`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email address — DataPilot</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; width: 100%; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, #182238 0%, #131b2e 100%);">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <!-- Logo & Brand -->
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); border-radius: 8px; text-align: center; line-height: 38px; color: #ffffff; font-weight: 800; font-size: 20px;">
                            DP
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">DataPilot</div>
                          <div style="font-size: 11px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Enterprise Analytics</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                Verify your email address
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                Thank you for joining DataPilot. To complete your account registration and unlock full access to workspaces, live datasets, and analytics pipelines, please confirm that this is your email address.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #0284c7 100%); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 13px 36px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); text-align: center;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0 20px 0; background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 14px 18px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #f59e0b;">
                      &#x23F1; Expiration Notice
                    </p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                      This verification link will remain valid for <strong>24 hours</strong>. If the link expires, you can request a new one from the DataPilot sign-in screen.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback Plain URL -->
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #1e293b;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                  If the button above does not work in your email client, copy and paste this link into your browser:
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; word-break: break-all; color: #38bdf8; font-family: monospace; background-color: #0b1120; padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                  ${escapedUrl}
                </p>
              </div>

              <!-- Security Note -->
              <p style="margin: 28px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                <strong>Security Notice:</strong> If you did not create an account on DataPilot, no action is needed. You can safely disregard this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px 36px; border-top: 1px solid #1e293b; background-color: #0d1322; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                DataPilot Enterprise Collaborative Analytics Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} DataPilot Inc. All rights reserved. &bull; Questions? Contact <a href="mailto:support@datapilot.io" style="color: #64748b; text-decoration: underline;">support@datapilot.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Generates HTML and plain text email for password reset.
 */
export function buildPasswordResetEmail(options: SendPasswordResetEmailOptions): { subject: string; html: string; text: string } {
  const recipientName = options.name ? escapeHtml(options.name) : 'there';
  const rawUrl = options.resetUrl;
  const escapedUrl = escapeHtml(rawUrl);

  const subject = 'Reset your DataPilot password';

  const text = `DataPilot — Password Reset Request

Hello ${options.name || 'there'},

We received a request to reset the password for your DataPilot account.

To choose a new password, please visit the link below:

${rawUrl}

This password reset link will expire in 20 minutes for your security and can only be used once.

If you did not request a password reset, please ignore this email. Your existing password will remain secure and unchanged.

—
DataPilot Enterprise Analytics Platform
https://datapilot.io
Support: support@datapilot.io`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your DataPilot password</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; width: 100%; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, #182238 0%, #131b2e 100%);">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); border-radius: 8px; text-align: center; line-height: 38px; color: #ffffff; font-weight: 800; font-size: 20px;">
                      DP
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">DataPilot</div>
                    <div style="font-size: 11px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Security & Account Recovery</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                Reset your password
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                We received a request to reset your password for your DataPilot account. Click the button below to choose a new, secure password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 13px 36px; border-radius: 8px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35); text-align: center;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0 20px 0; background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 14px 18px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #f59e0b;">
                      &#x23F1; Security Expiration Notice
                    </p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                      For your security, this password reset link will expire in <strong>20 minutes</strong> and can be used only once.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback Plain URL -->
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #1e293b;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                  If the button above does not work in your email client, copy and paste this link into your browser:
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; word-break: break-all; color: #38bdf8; font-family: monospace; background-color: #0b1120; padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                  ${escapedUrl}
                </p>
              </div>

              <!-- Security Note -->
              <p style="margin: 28px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                <strong>Security Notice:</strong> If you did not request a password reset, you can safely ignore this email. Your account password has not been changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px 36px; border-top: 1px solid #1e293b; background-color: #0d1322; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                DataPilot Enterprise Collaborative Analytics Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} DataPilot Inc. All rights reserved. &bull; Security team: <a href="mailto:security@datapilot.io" style="color: #64748b; text-decoration: underline;">security@datapilot.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
