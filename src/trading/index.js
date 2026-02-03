/**
 * @fileoverview Trading Pipeline Module
 * @module trading
 *
 * A modular, transparent trade generation system with:
 * - Observable pipeline architecture
 * - Multiple AI provider support
 * - Composable validators
 * - Glass Box transparency
 * - Full telemetry and audit trail
 *
 * @example
 * // Basic usage with pipeline
 * import { createTradePipeline, allSteps } from './trading';
 *
 * const pipeline = createTradePipeline()
 *   .addStep(allSteps.fetchPrices)
 *   .addStep(allSteps.buildContext)
 *   .addStep(allSteps.generatePrompt)
 *   .addStep(allSteps.callAI)
 *   .addStep(allSteps.parseResponse)
 *   .addStep(allSteps.validateTrades)
 *   .addStep(allSteps.enrichGlassBox);
 *
 * const result = await pipeline.execute({
 *   prompt: { name: 'My Strategy', content: '...' },
 *   config: { capital: 1000, leverage: 5, aiProvider: 'anthropic' }
 * });
 *
 * @example
 * // React usage with hook
 * import { useTradePipeline, GenerationProgress, GlassBoxDisplay } from './trading';
 *
 * function TradeGenerator() {
 *   const { execute, trades, events, isRunning } = useTradePipeline();
 *
 *   return (
 *     <>
 *       <button onClick={() => execute({ prompt, config })}>Generate</button>
 *       {isRunning && <GenerationProgress events={events} />}
 *       {trades.map(t => <GlassBoxDisplay key={t.id} glassBox={t.glassBox} />)}
 *     </>
 *   );
 * }
 */

// ==================== PIPELINE ====================
export { TradePipeline, createTradePipeline } from './pipeline/index.js';

// ==================== STEPS ====================
export {
  fetchPricesStep,
  buildContextStep,
  generatePromptStep,
  callAIStep,
  parseResponseStep,
  validateTradesStep,
  enrichGlassBoxStep,
  allSteps,
  stepMetadata,
  // Utilities
  fetchBinancePrices,
  fetchBinance24hStats,
  analyzeMarketConditions,
  calculatePositionSizing,
  buildSystemPrompt,
  extractJsonFromText,
  validateTradeStructure
} from './pipeline/steps/index.js';

// ==================== PROVIDERS ====================
export {
  getProvider,
  getAvailableProviders,
  getAllProviderInfo,
  registerProvider,
  BaseProvider,
  anthropicProvider,
  openaiProvider,
  googleProvider,
  xaiProvider
} from './providers/index.js';

// ==================== VALIDATORS ====================
export {
  TradeValidator,
  riskRewardValidator,
  priceLevelValidator,
  ipeScoreValidator,
  leverageValidator,
  priceDeviationValidator,
  volumeValidator,
  createStandardValidator
} from './validators/index.js';

// ==================== GLASS BOX ====================
export {
  GlassBoxBuilder,
  createFullGlassBox,
  createMinimalGlassBox
} from './glassbox/index.js';

// ==================== TELEMETRY ====================
export {
  PipelineTelemetry,
  createTelemetry
} from './telemetry/index.js';

// ==================== TYPES ====================
export {
  EXECUTION_LIMITS,
  DEFAULT_ASSETS,
  DEFAULT_CONFIG,
  generateTradeId,
  generateExecutionId
} from './types/index.js';

// ==================== HOOKS ====================
export {
  useTradePipeline,
  useTradeGenerator
} from './hooks/index.js';

// ==================== COMPONENTS ====================
export {
  // Existing
  GenerationProgress,
  GlassBoxDisplay,
  progressStyles,
  glassBoxStyles,
  allStyles,
  // Event Log
  EventLog,
  EventRow,
  EVENT_TYPES,
  STEP_ICONS,
  STEP_NAMES,
  LEVEL_COLORS,
  formatEvent,
  getLevelColor,
  formatTimestamp,
  // Incubator
  Incubator,
  EggCard
} from './components/index.js';

// ==================== CONVENIENCE ====================

/**
 * Create a fully configured pipeline ready to execute
 * @param {Object} options - Pipeline options
 * @returns {TradePipeline} Ready-to-use pipeline
 */
export function createReadyPipeline(options = {}) {
  const { TradePipeline } = require('./pipeline/index.js');
  const steps = require('./pipeline/steps/index.js');

  const pipeline = new TradePipeline(options);

  return pipeline
    .addStep(steps.fetchPricesStep)
    .addStep(steps.buildContextStep)
    .addStep(steps.generatePromptStep)
    .addStep(steps.callAIStep)
    .addStep(steps.parseResponseStep)
    .addStep(steps.validateTradesStep)
    .addStep(steps.enrichGlassBoxStep);
}

/**
 * Generate trades with a single function call
 * @param {Object} prompt - Strategy prompt
 * @param {Object} config - Trade configuration
 * @returns {Promise<Object>} Pipeline result
 */
export async function generateTrades(prompt, config) {
  const pipeline = createReadyPipeline();
  return pipeline.execute({ prompt, config });
}

// ==================== VERSION ====================
export const VERSION = '1.0.0';
