/**
 * @fileoverview Pipeline steps exports
 * @module trading/pipeline/steps
 */

export { fetchPricesStep, fetchBinancePrices, fetchBinance24hStats } from './01-fetchPrices.js';
export { buildContextStep, analyzeMarketConditions, calculatePositionSizing, getExecutionParameters } from './02-buildContext.js';
export { generatePromptStep, buildSystemPrompt, buildMarketDataSection, buildMarketAnalysisSection, buildConfigSection, buildOutputFormatSection } from './03-generatePrompt.js';
export { callAIStep } from './04-callAI.js';
export { parseResponseStep, extractJsonFromText, validateTradeStructure, normalizeTrade } from './05-parseResponse.js';
export { validateTradesStep, createDefaultValidator } from './06-validateTrades.js';
export { enrichGlassBoxStep } from './07-enrichGlassBox.js';

/**
 * All steps in execution order
 */
export const allSteps = [
  'fetchPricesStep',
  'buildContextStep',
  'generatePromptStep',
  'callAIStep',
  'parseResponseStep',
  'validateTradesStep',
  'enrichGlassBoxStep'
];

/**
 * Step metadata for UI display
 */
export const stepMetadata = {
  fetchPrices: {
    key: 'fetchPrices',
    label: 'Fetching prices',
    icon: '📊',
    description: 'Getting real-time prices from Binance'
  },
  buildContext: {
    key: 'buildContext',
    label: 'Building context',
    icon: '🔧',
    description: 'Analyzing market conditions and preparing configuration'
  },
  generatePrompt: {
    key: 'generatePrompt',
    label: 'Preparing prompt',
    icon: '📝',
    description: 'Generating AI prompt with strategy and market data'
  },
  callAI: {
    key: 'callAI',
    label: 'Calling AI',
    icon: '🤖',
    description: 'Sending request to AI provider'
  },
  parseResponse: {
    key: 'parseResponse',
    label: 'Parsing response',
    icon: '⚙️',
    description: 'Extracting and normalizing trade data'
  },
  validateTrades: {
    key: 'validateTrades',
    label: 'Validating trades',
    icon: '✅',
    description: 'Running validation checks on each trade'
  },
  enrichGlassBox: {
    key: 'enrichGlassBox',
    label: 'Adding transparency',
    icon: '🔍',
    description: 'Generating Glass Box transparency data'
  }
};
