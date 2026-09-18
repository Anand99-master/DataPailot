import { IEmailProvider, EmailPayload } from '../types';

export class ResendProvider implements IEmailProvider {
  public readonly name = 'resend';
  private apiKey: string;
  private defaultFrom: string;
  private defaultReplyTo: string;

  constructor() {
    this.apiKey = (process.env.EMAIL_API_KEY || '').trim();
    this.defaultFrom = (process.env.EMAIL_FROM || 'DataPilot <onboarding@resend.dev>').trim();
    this.defaultReplyTo = (process.env.EMAIL_REPLY_TO || 'support@datapilot.io').trim();
  }

  public get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
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
        error: 'Resend API key (EMAIL_API_KEY) is not configured',
        deliveryMode: 'real'
      };
    }

    try {
      const fromAddress = payload.from || this.defaultFrom;
      const replyToAddress = payload.replyTo || this.defaultReplyTo;

      const body: Record<string, any> = {
        from: fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text
      };

      if (replyToAddress) {
        body.reply_to = replyToAddress;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const responseText = await response.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { message: responseText };
      }

      if (!response.ok) {
        const errorMsg = responseData?.message || responseData?.error || `HTTP ${response.status} from Resend`;
        return {
          success: false,
          error: errorMsg,
          deliveryMode: 'real'
        };
      }

      return {
        success: true,
        messageId: responseData?.id || 'resend_ok',
        deliveryMode: 'real'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error delivering email via Resend',
        deliveryMode: 'real'
      };
    }
  }
}
