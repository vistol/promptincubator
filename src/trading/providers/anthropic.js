/**
 * @fileoverview Anthropic Claude AI Provider
 * @module trading/providers/anthropic
 */

import { BaseProvider } from './base.js';

/**
 * Anthropic Claude provider
 */
class AnthropicProvider extends BaseProvider {
  constructor() {
    super({
      name: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      baseUrl: 'https://api.anthropic.com/v1',
      defaultOptions: {
        maxTokens: 4000,
        temperature: 0.7
      }
    });
  }

  /**
   * Validate Anthropic API key format
   * @param {string} apiKey - API key
   * @returns {boolean} Whether key appears valid
   */
  validateApiKey(apiKey) {
    return typeof apiKey === 'string' && apiKey.startsWith('sk-ant-');
  }

  /**
   * Generate completion using Claude
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Response object
   */
  async generate(params) {
    const { systemPrompt, userPrompt, apiKey, options = {} } = params;

    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid Anthropic API key format. Key should start with "sk-ant-"');
    }

    const requestBody = {
      model: this.model,
      max_tokens: options.maxTokens || this.defaultOptions.maxTokens,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    };

    // Add system prompt if provided
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    // Add temperature if not default
    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    const response = await this.request(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    return {
      content: response.content[0]?.text || '',
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0
      },
      raw: response
    };
  }
}

export default new AnthropicProvider();
