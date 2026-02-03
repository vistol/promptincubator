/**
 * @fileoverview Step 4: Call AI provider API
 * @module trading/pipeline/steps/callAI
 */

import { getProvider } from '../../providers/index.js';

/**
 * Call AI step definition
 */
export const callAIStep = {
  name: 'callAI',
  description: 'Calls the selected AI provider to generate trades',

  inputSchema: {
    type: 'object',
    required: ['generatePrompt'],
    properties: {
      generatePrompt: { type: 'object' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      response: { type: 'string' },
      metadata: { type: 'object' }
    }
  },

  timeout: 60000, // 60 seconds for AI calls
  retries: 1,
  optional: false,

  /**
   * Execute the call AI step
   * @param {Object} context - Pipeline context
   * @returns {Promise<Object>} AI response and metadata
   */
  async execute(context) {
    const { telemetry } = context;
    const { config } = context.results.buildContext;
    const { systemPrompt, userPrompt, fullPrompt } = context.results.generatePrompt;

    const providerName = config.aiProvider || 'anthropic';

    telemetry?.info('callAI', `Calling AI provider: ${providerName}`, {
      provider: providerName
    });

    // Get the provider
    const provider = await getProvider(providerName);

    if (!provider) {
      throw new Error(`Unknown AI provider: ${providerName}`);
    }

    telemetry?.debug('callAI', 'Provider loaded', {
      model: provider.model,
      provider: provider.name
    });

    // Get API key from config or environment
    const apiKey = config.apiKeys?.[providerName] ||
                   process.env[`${providerName.toUpperCase()}_API_KEY`];

    if (!apiKey) {
      throw new Error(`No API key found for provider: ${providerName}`);
    }

    const startTime = Date.now();

    try {
      // Call the provider
      const response = await provider.generate({
        systemPrompt,
        userPrompt,
        fullPrompt,
        apiKey,
        options: {
          maxTokens: 4000,
          temperature: 0.7
        }
      });

      const latency = Date.now() - startTime;

      telemetry?.info('callAI', 'AI response received', {
        latency,
        tokensUsed: response.usage,
        contentLength: response.content?.length
      });

      return {
        response: response.content,
        metadata: {
          provider: providerName,
          model: provider.model,
          latency,
          tokensUsed: response.usage,
          timestamp: Date.now(),
          // For Glass Box transparency
          promptUsed: {
            system: systemPrompt,
            user: userPrompt
          },
          rawResponse: response.raw
        }
      };

    } catch (error) {
      telemetry?.error('callAI', `AI provider error: ${error.message}`, {
        provider: providerName,
        latency: Date.now() - startTime
      });

      // Enhance error message
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        throw new Error(`Invalid API key for ${providerName}`);
      }
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        throw new Error(`Rate limit exceeded for ${providerName}. Please try again later.`);
      }
      if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        throw new Error(`${providerName} service is temporarily unavailable`);
      }

      throw error;
    }
  }
};

export default callAIStep;
