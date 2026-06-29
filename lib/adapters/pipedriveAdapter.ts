import { IntegrationAdapter, AdapterStatus } from './base';

class PipedriveAdapter implements IntegrationAdapter {
  getStatus(): AdapterStatus {
    const key = process.env.PIPEDRIVE_API_KEY;
    if (!key || key === 'mock_pipedrive_key') {
      return { isConfigured: false, error: 'PIPEDRIVE_API_KEY is missing or mocked' };
    }
    return { isConfigured: true };
  }

  validateConfig(): void {
    const status = this.getStatus();
    if (!status.isConfigured) {
      throw new Error(`Pipedrive Adapter not configured: ${status.error}`);
    }
  }
}

export const pipedriveAdapter = new PipedriveAdapter();
