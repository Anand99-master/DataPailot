import { IEmailProvider, EmailPayload, maskEmail, extractDomain } from '../types';
import { Logger } from '../../../utils/logger';

export class DevelopmentFallbackProvider implements IEmailProvider {
  public readonly name = 'development_fallback';
  public readonly isConfigured = true;

  public async sendEmail(payload: EmailPayload): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    deliveryMode: 'real' | 'development_fallback';
  }> {
    const masked = maskEmail(payload.to);
    const domain = extractDomain(payload.to);
    const mockId = `dev_msg_${Date.now().toString(36)}`;

    // Safe operational logging: NEVER log token, tokenized URL, password, or secret
    Logger.info('[DEV EMAIL DISPATCH] Real email provider not configured; development fallback active', {
      emailType: payload.emailType,
      recipientDomain: domain,
      recipientMasked: masked,
      provider: this.name,
      deliveryMode: 'development_fallback',
      messageId: mockId
    });

    return {
      success: true,
      messageId: mockId,
      deliveryMode: 'development_fallback'
    };
  }
}
