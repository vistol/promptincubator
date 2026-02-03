/**
 * @fileoverview Base AI Provider class
 * @module trading/providers/base
 */

/**
 * Base class for AI providers
 * Defines the interface that all providers must implement
 */
export class BaseProvider {
  constructor(options = {}) {
    this.name = options.name || 'unknown';
    this.model = options.model || 'unknown';
    this.baseUrl = options.baseUrl || '';
    this.defaultOptions = {
      maxTokens: 4000,
      temperature: 0.7,
      ...options.defaultOptions
    };
  }

  /**
   * Generate completion from the AI
   * @param {Object} params - Generation parameters
   * @param {string} params.systemPrompt - System prompt
   * @param {string} params.userPrompt - User prompt
   * @param {string} params.fullPrompt - Combined prompt (for providers without system message support)
   * @param {string} params.apiKey - API key
   * @param {Object} params.options - Generation options
   * @returns {Promise<Object>} Response object
   */
  async generate(params) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key to validate
   * @returns {boolean} Whether key appears valid
   */
  validateApiKey(apiKey) {
    return typeof apiKey === 'string' && apiKey.length > 10;
  }

  /**
   * Make HTTP request with error handling
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Parsed response
   */
  async request(url, options) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMessage = errorText;
      }

      throw new Error(`${this.name} API error (${response.status}): ${errorMessage}`);
    }

    return response.json();
  }

  /**
   * Get provider information
   * @returns {Object} Provider info
   */
  getInfo() {
    return {
      name: this.name,
      model: this.model,
      baseUrl: this.baseUrl
    };
  }
}

export default BaseProvider;
