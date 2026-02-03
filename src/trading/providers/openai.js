/**
 * @fileoverview OpenAI GPT Provider
 * @module trading/providers/openai
 */

import { BaseProvider } from './base.js';

/**
 * OpenAI GPT provider
 */
class OpenAIProvider extends BaseProvider {
  constructor() {
    super({
      name: 'openai',
      model: 'gpt-4-turbo-preview',
      baseUrl: 'https://api.openai.com/v1',
      defaultOptions: {
        maxTokens: 4000,
        temperature: 0.7
      }
    });
  }

  /**
   * Validate OpenAI API key format
   * @param {string} apiKey - API key
   * @returns {boolean} Whether key appears valid
   */
  validateApiKey(apiKey) {
    return typeof apiKey === 'string' && apiKey.startsWith('sk-');
  }

  /**
   * Generate completion using GPT
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Response object
   */
  async generate(params) {
    const { systemPrompt, userPrompt, apiKey, options = {} } = params;

    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid OpenAI API key format. Key should start with "sk-"');
    }

    const messages = [];

    // Add system message if provided
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add user message
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

    // Request JSON response format
    requestBody.response_format = { type: 'json_object' };

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

export default new OpenAIProvider();
