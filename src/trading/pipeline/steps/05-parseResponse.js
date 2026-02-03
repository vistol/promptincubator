/**
 * @fileoverview Step 5: Parse and extract trades from AI response
 * @module trading/pipeline/steps/parseResponse
 */

import { generateTradeId } from '../../types/index.js';

/**
 * Extract JSON from text that may contain markdown or other content
 * @param {string} text - Text containing JSON
 * @returns {string|null} Extracted JSON string or null
 */
function extractJsonFromText(text) {
  if (!text) return null;

  // Try to find JSON array directly
  const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    return jsonArrayMatch[0];
  }

  // Try to find JSON in code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    const innerJsonMatch = content.match(/\[[\s\S]*\]/);
    if (innerJsonMatch) {
      return innerJsonMatch[0];
    }
  }

  return null;
}

/**
 * Validate trade structure
 * @param {Object} trade - Trade object
 * @returns {Object} Validation result
 */
function validateTradeStructure(trade) {
  const errors = [];
  const warnings = [];

  // Required fields
  const requiredFields = ['asset', 'strategy', 'entry', 'takeProfit', 'stopLoss', 'ipe'];
  for (const field of requiredFields) {
    if (trade[field] === undefined || trade[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate strategy
  if (trade.strategy && !['LONG', 'SHORT'].includes(trade.strategy.toUpperCase())) {
    errors.push(`Invalid strategy: ${trade.strategy}. Must be LONG or SHORT`);
  }

  // Validate IPE range
  if (trade.ipe !== undefined) {
    if (trade.ipe < 70 || trade.ipe > 95) {
      warnings.push(`IPE ${trade.ipe} outside recommended range 70-95`);
    }
  }

  // Validate price levels are numbers
  const priceFields = ['entry', 'takeProfit', 'stopLoss'];
  for (const field of priceFields) {
    if (trade[field] !== undefined && typeof trade[field] !== 'number') {
      // Try to convert
      const parsed = parseFloat(trade[field]);
      if (isNaN(parsed)) {
        errors.push(`Invalid ${field}: must be a number`);
      }
    }
  }

  // Validate reasoning structure
  if (trade.reasoning) {
    const reasoningFields = ['whyAsset', 'whyDirection', 'whyEntry', 'whyLevels'];
    for (const field of reasoningFields) {
      if (!trade.reasoning[field]) {
        warnings.push(`Missing reasoning field: ${field}`);
      }
    }
  } else {
    warnings.push('Missing reasoning object');
  }

  // Validate criteriaMatched
  if (!trade.criteriaMatched || !Array.isArray(trade.criteriaMatched)) {
    warnings.push('Missing or invalid criteriaMatched array');
  } else if (trade.criteriaMatched.length < 3) {
    warnings.push('Less than 3 criteria provided');
  }

  // Validate confidenceFactors
  if (!trade.confidenceFactors || !Array.isArray(trade.confidenceFactors)) {
    warnings.push('Missing or invalid confidenceFactors array');
  } else {
    const totalWeight = trade.confidenceFactors.reduce((sum, f) => sum + (f.weight || 0), 0);
    if (totalWeight !== 100) {
      warnings.push(`Confidence factor weights sum to ${totalWeight}, should be 100`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Normalize trade data
 * @param {Object} trade - Raw trade object
 * @param {number} index - Trade index
 * @param {Object} context - Pipeline context
 * @returns {Object} Normalized trade
 */
function normalizeTrade(trade, index, context) {
  const { prompt } = context.input;
  const { prices } = context.results.fetchPrices;
  const { config, positionSizing } = context.results.buildContext;

  // Normalize strategy to uppercase
  const strategy = (trade.strategy || 'LONG').toUpperCase();

  // Parse numeric fields
  const entry = parseFloat(trade.entry);
  const takeProfit = parseFloat(trade.takeProfit);
  const stopLoss = parseFloat(trade.stopLoss);

  // Get current price
  const currentPriceData = prices[trade.asset];
  const currentPrice = currentPriceData?.price || entry;

  // Calculate risk/reward
  const reward = Math.abs(takeProfit - entry);
  const risk = Math.abs(entry - stopLoss);
  const riskRewardRatio = risk > 0 ? reward / risk : 0;

  // Calculate percentages
  const riskPercent = (risk / entry) * 100;
  const rewardPercent = (reward / entry) * 100;

  return {
    id: generateTradeId(index),
    promptId: prompt?.id || null,
    promptName: prompt?.name || 'Custom Strategy',
    asset: trade.asset,
    strategy,
    entry,
    takeProfit,
    stopLoss,
    currentPrice,
    riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
    riskPercent: parseFloat(riskPercent.toFixed(2)),
    rewardPercent: parseFloat(rewardPercent.toFixed(2)),
    ipe: trade.ipe || 75,
    summary: trade.summary || '',
    reasoning: trade.reasoning || {
      whyAsset: 'Not provided',
      whyDirection: 'Not provided',
      whyEntry: 'Not provided',
      whyLevels: 'Not provided'
    },
    criteriaMatched: trade.criteriaMatched || [],
    confidenceFactors: trade.confidenceFactors || [],
    status: 'pending',
    selected: false,
    createdAt: new Date().toISOString(),
    leverage: config.leverage,
    capital: positionSizing.capitalPerTrade,
    // Metadata for transparency
    _raw: trade,
    _validation: validateTradeStructure(trade)
  };
}

/**
 * Parse response step definition
 */
export const parseResponseStep = {
  name: 'parseResponse',
  description: 'Parses AI response and extracts trade data',

  inputSchema: {
    type: 'object',
    required: ['callAI'],
    properties: {
      callAI: { type: 'object' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      trades: { type: 'array' },
      parseErrors: { type: 'array' },
      metadata: { type: 'object' }
    }
  },

  timeout: 5000,
  optional: false,

  /**
   * Execute the parse response step
   * @param {Object} context - Pipeline context
   * @returns {Promise<Object>} Parsed trades
   */
  async execute(context) {
    const { telemetry } = context;
    const { response } = context.results.callAI;
    const { config } = context.results.buildContext;

    telemetry?.debug('parseResponse', 'Parsing AI response', {
      responseLength: response?.length
    });

    // Extract JSON from response
    const jsonString = extractJsonFromText(response);

    if (!jsonString) {
      telemetry?.error('parseResponse', 'No JSON found in response');
      throw new Error('Failed to extract JSON from AI response');
    }

    // Parse JSON
    let rawTrades;
    try {
      rawTrades = JSON.parse(jsonString);
    } catch (error) {
      telemetry?.error('parseResponse', 'JSON parse error', {
        error: error.message
      });
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }

    // Ensure it's an array
    if (!Array.isArray(rawTrades)) {
      rawTrades = [rawTrades];
    }

    telemetry?.info('parseResponse', `Parsed ${rawTrades.length} trades from response`);

    // Normalize and validate each trade
    const trades = [];
    const parseErrors = [];
    const validationWarnings = [];

    for (let i = 0; i < rawTrades.length; i++) {
      try {
        const normalized = normalizeTrade(rawTrades[i], i, context);

        if (normalized._validation.errors.length > 0) {
          parseErrors.push({
            index: i,
            errors: normalized._validation.errors
          });
          telemetry?.warn('parseResponse', `Trade ${i} has validation errors`, {
            errors: normalized._validation.errors
          });
        }

        if (normalized._validation.warnings.length > 0) {
          validationWarnings.push({
            index: i,
            warnings: normalized._validation.warnings
          });
        }

        trades.push(normalized);
      } catch (error) {
        parseErrors.push({
          index: i,
          errors: [error.message]
        });
        telemetry?.error('parseResponse', `Failed to normalize trade ${i}`, {
          error: error.message
        });
      }
    }

    // Check if we got expected number of trades
    const expectedCount = config.numResults;
    if (trades.length < expectedCount) {
      telemetry?.warn('parseResponse', `Got ${trades.length} trades, expected ${expectedCount}`);
    }

    return {
      trades,
      parseErrors,
      validationWarnings,
      metadata: {
        rawCount: rawTrades.length,
        normalizedCount: trades.length,
        errorCount: parseErrors.length,
        warningCount: validationWarnings.length,
        timestamp: Date.now()
      }
    };
  }
};

// Export utilities
export { extractJsonFromText, validateTradeStructure, normalizeTrade };

export default parseResponseStep;
