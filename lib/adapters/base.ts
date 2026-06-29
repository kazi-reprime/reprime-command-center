export interface AdapterStatus {
  isConfigured: boolean;
  error?: string;
}

export interface IntegrationAdapter {
  /**
   * Returns the current configuration status of the adapter.
   * Never throws.
   */
  getStatus(): AdapterStatus | Promise<AdapterStatus>;
  
  /**
   * Throws an error if the adapter is not configured.
   * Useful for API routes to quickly bail out.
   */
  validateConfig(): void;
}
