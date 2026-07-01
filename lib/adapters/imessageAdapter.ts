import { IntegrationAdapter, AdapterStatus } from './base';

class IMessageAdapter implements IntegrationAdapter {
  getStatus(): AdapterStatus {
    const secret = process.env.BLUEBUBBLES_WEBHOOK_SECRET;
    if (!secret || secret === 'mock_secret') {
      return { isConfigured: false, error: 'BLUEBUBBLES_WEBHOOK_SECRET is missing or mocked' };
    }
    return { isConfigured: true };
  }

  validateConfig(): void {
    const status = this.getStatus();
    if (!status.isConfigured) {
      throw new Error(`iMessage Adapter not configured: ${status.error}`);
    }
  }
}

export const imessageAdapter = new IMessageAdapter();
