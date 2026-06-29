import { IntegrationAdapter, AdapterStatus } from './base';

class WhatsAppAdapter implements IntegrationAdapter {
  getStatus(): AdapterStatus {
    const key = process.env.TIMELINES_API_KEY;
    if (!key || key === 'mock_timelines_key') {
      return { isConfigured: false, error: 'TIMELINES_API_KEY is missing or mocked' };
    }
    return { isConfigured: true };
  }

  validateConfig(): void {
    const status = this.getStatus();
    if (!status.isConfigured) {
      throw new Error(`WhatsApp Adapter not configured: ${status.error}`);
    }
  }
}

export const whatsappAdapter = new WhatsAppAdapter();
