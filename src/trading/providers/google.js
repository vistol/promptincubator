/**
 * @fileoverview Google Gemini AI Provider
 * @module trading/providers/google
 */

import { BaseProvider } from './base.js';

/**
 * Google Gemini provider
 */
class GoogleProvider extends BaseProvider {
  constructor() {
    super({
      name: 'google',
      model: 'gemini-1.5-pro',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultOptions: {
        maxTokens: 4000,
        temperature: 0.7
      }
    });
  }

  /**
   * Validate Google API key format
   * @param {string} apiKey - API key
   * @returns {boolean} Whether key appears valid
   */
  validateApiKey(apiKey) {
    // Google API keys are typically 39 characters
    return typeof apiKey === 'string' && apiKey.length >= 30;
  }

  /**
   * Generate completion using Gemini
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Response object
   */
  async generate(params) {
    const { systemPrompt, userPrompt, fullPrompt, apiKey, options = {} } = params;

    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid Google API key format');
    }

    // Gemini uses a different message structure
    // Combine system and user prompt for Gemini
    const combinedPrompt = systemPrompt
      ? `${systemPrompt}\n\n---\n\n${userPrompt}`
      : userPrompt;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: combinedPrompt
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: options.maxTokens || this.defaultOptions.maxTokens,
        temperature: options.temperature ?? this.defaultOptions.temperature
      }
    };

    // Add safety settings to allow trading-related content
    requestBody.safetySettings = [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH'
      }
    ];

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${apiKey}`;

    const response = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    // Extract text from Gemini response
    const candidate = response.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';

    // Calculate token usage (Gemini provides this differently)
    const usage = {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0
    };

    return {
      content,
      usage,
      raw: response,
      finishReason: candidate?.finishReason
    };
  }
}

export default new GoogleProvider();
