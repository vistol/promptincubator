/**
 * @fileoverview AI Providers factory and exports
 * @module trading/providers
 */

import anthropicProvider from './anthropic.js';
import openaiProvider from './openai.js';
import googleProvider from './google.js';
import xaiProvider from './xai.js';
import { BaseProvider } from './base.js';

/**
 * Registry of available providers
 */
const providers = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
  xai: xaiProvider
};

/**
 * Get a provider by name
 * @param {string} name - Provider name
 * @returns {Promise<BaseProvider>} Provider instance
 */
export async function getProvider(name) {
  const provider = providers[name];

  if (!provider) {
    throw new Error(`Unknown AI provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }

  return provider;
}

/**
 * Get list of available provider names
 * @returns {string[]} Provider names
 */
export function getAvailableProviders() {
  return Object.keys(providers);
}

/**
 * Get provider info for all providers
 * @returns {Object[]} Provider info array
 */
export function getAllProviderInfo() {
  return Object.entries(providers).map(([name, provider]) => ({
    name,
    ...provider.getInfo()
  }));
}

/**
 * Register a custom provider
 * @param {string} name - Provider name
 * @param {BaseProvider} provider - Provider instance
 */
export function registerProvider(name, provider) {
  if (!(provider instanceof BaseProvider)) {
    throw new Error('Provider must extend BaseProvider');
  }
  providers[name] = provider;
}

// Export individual providers
export { anthropicProvider, openaiProvider, googleProvider, xaiProvider };

// Export base class for custom providers
export { BaseProvider };

export default {
  getProvider,
  getAvailableProviders,
  getAllProviderInfo,
  registerProvider
};
