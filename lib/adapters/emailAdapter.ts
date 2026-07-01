import { IntegrationAdapter, AdapterStatus } from './base';

class EmailAdapter implements IntegrationAdapter {
  getStatus(): AdapterStatus {
    const key = process.env.SENDGRID_API_KEY;
    if (!key || key.includes('mock')) {
      return { isConfigured: false, error: 'SENDGRID_API_KEY is missing or mocked' };
    }
    return { isConfigured: true };
  }

  validateConfig(): void {
    const status = this.getStatus();
    if (!status.isConfigured) {
      throw new Error(`Email Adapter not configured: ${status.error}`);
    }
  }
}

export const emailAdapter = new EmailAdapter();
