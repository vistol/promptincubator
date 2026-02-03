/**
 * @fileoverview Type definitions and interfaces for the trading pipeline
 * @module trading/types
 */

/**
 * @typedef {Object} PriceData
 * @property {number} price - Current price
 * @property {number} timestamp - Unix timestamp
 * @property {string} source - Price source (e.g., 'binance')
 * @property {number} [high24h] - 24h high
 * @property {number} [low24h] - 24h low
 * @property {number} [volume24h] - 24h volume
 * @property {number} [priceChange24h] - 24h price change percentage
 */

/**
 * @typedef {Object} TradeConfig
 * @property {string[]} assets - List of assets to consider
 * @property {number} capital - Total capital to use
 * @property {number} leverage - Leverage multiplier (1-50)
 * @property {'target'|'scalping'|'intraday'|'swing'} executionTime - Execution timeframe
 * @property {number} targetPct - Target profit percentage
 * @property {number} minIpe - Minimum IPE score (70-95)
 * @property {number} numResults - Number of trades to generate (1-5)
 * @property {'anthropic'|'openai'|'google'|'xai'} aiProvider - AI provider
 * @property {number} [minRiskReward] - Minimum risk/reward ratio (default: 2)
 * @property {number} [maxEntryDeviation] - Max entry deviation from current price (default: 0.05)
 */

/**
 * @typedef {Object} StrategyPrompt
 * @property {string} id - Unique prompt ID
 * @property {string} name - Strategy name
 * @property {string} content - Strategy description/rules
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} Trade
 * @property {string} id - Unique trade ID
 * @property {string} promptId - Associated prompt ID
 * @property {string} promptName - Associated prompt name
 * @property {string} asset - Trading pair (e.g., 'BTC/USDT')
 * @property {'LONG'|'SHORT'} strategy - Trade direction
 * @property {number} entry - Entry price
 * @property {number} takeProfit - Take profit price
 * @property {number} stopLoss - Stop loss price
 * @property {number} currentPrice - Current market price
 * @property {number} riskRewardRatio - Risk/reward ratio
 * @property {number} riskPercent - Risk percentage
 * @property {number} rewardPercent - Reward percentage
 * @property {number} ipe - Investment Potential Estimate (70-95)
 * @property {string} summary - Trade summary
 * @property {TradeReasoning} reasoning - Detailed reasoning
 * @property {CriteriaMatch[]} criteriaMatched - Matched criteria
 * @property {ConfidenceFactor[]} confidenceFactors - Confidence breakdown
 * @property {'pending'|'active'|'closed'} status - Trade status
 * @property {boolean} selected - User selection state
 * @property {Date} createdAt - Creation timestamp
 * @property {number} leverage - Applied leverage
 * @property {number} capital - Allocated capital
 */

/**
 * @typedef {Object} TradeReasoning
 * @property {string} whyAsset - Explanation for asset selection
 * @property {string} whyDirection - Explanation for trade direction
 * @property {string} whyEntry - Explanation for entry price
 * @property {string} whyLevels - Explanation for TP/SL levels
 */

/**
 * @typedef {Object} CriteriaMatch
 * @property {string} criterion - Criterion name
 * @property {string} value - Actual value
 * @property {string} [threshold] - Required threshold
 * @property {boolean} passed - Whether criterion passed
 */

/**
 * @typedef {Object} ConfidenceFactor
 * @property {string} factor - Factor name
 * @property {number} weight - Weight percentage (0-100)
 * @property {number} score - Score (0-100)
 * @property {number} contribution - Weighted contribution
 */

/**
 * @typedef {Object} ValidationResult
 * @property {string} name - Validator name
 * @property {boolean} passed - Whether validation passed
 * @property {string} message - Result message
 * @property {*} value - Actual value
 * @property {*} threshold - Required threshold
 */

/**
 * @typedef {Object} PipelineStep
 * @property {string} name - Step name
 * @property {string} description - Step description
 * @property {Function} execute - Execution function
 * @property {boolean} [optional] - Whether step is optional
 * @property {number} [timeout] - Step timeout in ms
 */

/**
 * @typedef {Object} PipelineContext
 * @property {Object} input - Original input
 * @property {Object} results - Results from each step
 * @property {TelemetryEvent[]} logs - Execution logs
 * @property {PipelineTelemetry} telemetry - Telemetry instance
 */

/**
 * @typedef {Object} TelemetryEvent
 * @property {number} timestamp - Event timestamp
 * @property {number} elapsed - Elapsed time from start
 * @property {'info'|'warn'|'error'|'debug'} level - Log level
 * @property {string} step - Step name
 * @property {string} message - Event message
 * @property {Object} [data] - Additional data
 */

/**
 * @typedef {Object} AIProviderResponse
 * @property {string} content - Generated content
 * @property {Object} usage - Token usage
 * @property {number} usage.inputTokens - Input tokens
 * @property {number} usage.outputTokens - Output tokens
 * @property {Object} raw - Raw API response
 */

/**
 * @typedef {Object} GlassBox
 * @property {TradeReasoning} reasoning - Trade reasoning
 * @property {CriteriaMatch[]} criteriaMatched - Matched criteria
 * @property {ConfidenceFactor[]} confidenceFactors - Confidence factors
 * @property {AuditTrail} auditTrail - Full audit trail
 */

/**
 * @typedef {Object} AuditTrail
 * @property {TelemetryEvent[]} pipelineSteps - Pipeline execution steps
 * @property {string} aiProvider - AI provider used
 * @property {string} model - AI model used
 * @property {string} promptUsed - Full prompt sent to AI
 * @property {Object} rawAIResponse - Raw AI response
 * @property {ValidationResult[]} validationResults - All validation results
 */

// Execution time limits in milliseconds
export const EXECUTION_LIMITS = {
  target: null, // No time limit, only SL/TP
  scalping: 60 * 60 * 1000, // 1 hour
  intraday: 24 * 60 * 60 * 1000, // 24 hours
  swing: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Default crypto assets to track
export const DEFAULT_ASSETS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
  'DOGE/USDT', 'ATOM/USDT', 'UNI/USDT', 'LTC/USDT', 'FIL/USDT'
];

// Default configuration values
export const DEFAULT_CONFIG = {
  capital: 1000,
  leverage: 1,
  executionTime: 'intraday',
  targetPct: 10,
  minIpe: 75,
  numResults: 3,
  aiProvider: 'anthropic',
  minRiskReward: 2,
  maxEntryDeviation: 0.05
};

/**
 * Generate unique trade ID
 * @param {number} index - Trade index
 * @returns {string} Unique trade ID
 */
export function generateTradeId(index = 0) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `trade-${timestamp}-${index}-${random}`;
}

/**
 * Generate unique execution ID
 * @returns {string} Unique execution ID
 */
export function generateExecutionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `exec-${timestamp}-${random}`;
}
