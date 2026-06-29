import { IntegrationAdapter, AdapterStatus } from './base';

class SmsAdapter implements IntegrationAdapter {
  getStatus(): AdapterStatus {
    const key = process.env.TWILIO_ACCOUNT_SID;
    if (!key || key === 'mock_twilio_account_sid') {
      return { isConfigured: false, error: 'TWILIO_ACCOUNT_SID is missing or mocked' };
    }
    return { isConfigured: true };
  }

  validateConfig(): void {
    const status = this.getStatus();
    if (!status.isConfigured) {
      throw new Error(`SMS Adapter not configured: ${status.error}`);
    }
  }
}

export const smsAdapter = new SmsAdapter();
