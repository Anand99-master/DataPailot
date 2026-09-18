import nodemailer, { Transporter } from 'nodemailer';
import { IEmailProvider, EmailPayload } from '../types';

export class SmtpProvider implements IEmailProvider {
  public readonly name = 'smtp';
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private secure: boolean;
  private defaultFrom: string;
  private defaultReplyTo: string;
  private transporter: Transporter | null = null;

  constructor() {
    this.host = (process.env.SMTP_HOST || '').trim();
    this.port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.user = (process.env.SMTP_USER || '').trim();
    this.pass = (process.env.SMTP_PASSWORD || '').trim();
    this.secure = process.env.SMTP_SECURE === 'true' || this.port === 465;
    this.defaultFrom = (process.env.EMAIL_FROM || 'DataPilot <notifications@datapilot.io>').trim();
    this.defaultReplyTo = (process.env.EMAIL_REPLY_TO || 'support@datapilot.io').trim();
  }

  public get isConfigured(): boolean {
    return Boolean(this.host && this.host.length > 0);
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.secure,
        auth: this.user ? {
          user: this.user,
          pass: this.pass
        } : undefined
      });
    }
    return this.transporter;
  }

  public async sendEmail(payload: EmailPayload): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    deliveryMode: 'real' | 'development_fallback';
  }> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'SMTP host (SMTP_HOST) is not configured',
        deliveryMode: 'real'
      };
    }

    try {
      const transporter = this.getTransporter();
      const fromAddress = payload.from || this.defaultFrom;
      const replyToAddress = payload.replyTo || this.defaultReplyTo;

      const info = await transporter.sendMail({
        from: fromAddress,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: replyToAddress || undefined
      });

      return {
        success: true,
        messageId: info.messageId || 'smtp_ok',
        deliveryMode: 'real'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to deliver email via SMTP',
        deliveryMode: 'real'
      };
    }
  }
}
