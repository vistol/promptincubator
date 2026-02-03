/**
 * @fileoverview xAI Grok Provider
 * @module trading/providers/xai
 */

import { BaseProvider } from './base.js';

/**
 * xAI Grok provider
 */
class XAIProvider extends BaseProvider {
  constructor() {
    super({
      name: 'xai',
      model: 'grok-beta',
      baseUrl: 'https://api.x.ai/v1',
      defaultOptions: {
        maxTokens: 4000,
        temperature: 0.7
      }
    });
  }

  /**
   * Validate xAI API key format
   * @param {string} apiKey - API key
   * @returns {boolean} Whether key appears valid
   */
  validateApiKey(apiKey) {
    return typeof apiKey === 'string' && apiKey.length >= 20;
  }

  /**
   * Generate completion using Grok
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Response object
   */
  async generate(params) {
    const { systemPrompt, userPrompt, apiKey, options = {} } = params;

    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid xAI API key format');
    }

    // xAI API is similar to OpenAI
    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: userPrompt
    });

    const requestBody = {
      model: this.model,
      messages,
      max_tokens: options.maxTokens || this.defaultOptions.maxTokens,
      temperature: options.temperature ?? this.defaultOptions.temperature
    };

    const response = await this.request(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const choice = response.choices?.[0];

    return {
      content: choice?.message?.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      },
      raw: response,
      finishReason: choice?.finish_reason
    };
  }
}

export default new XAIProvider();
