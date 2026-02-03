/**
 * @fileoverview Step 6: Validate trades using composable validators
 * @module trading/pipeline/steps/validateTrades
 */

import { TradeValidator } from '../../validators/index.js';
import {
  riskRewardValidator,
  priceLevelValidator,
  ipeScoreValidator,
  leverageValidator,
  priceDeviationValidator
} from '../../validators/index.js';

/**
 * Create default validator chain
 * @param {Object} config - Trade configuration
 * @returns {TradeValidator} Configured validator
 */
function createDefaultValidator(config) {
  return new TradeValidator()
    .add(riskRewardValidator)
    .add(priceLevelValidator)
    .add(ipeScoreValidator)
    .add(leverageValidator)
    .add(priceDeviationValidator);
}

/**
 * Validate trades step definition
 */
export const validateTradesStep = {
  name: 'validateTrades',
  description: 'Validates trades using composable validators',

  inputSchema: {
    type: 'object',
    required: ['parseResponse'],
    properties: {
      parseResponse: { type: 'object' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      validTrades: { type: 'array' },
      invalidTrades: { type: 'array' },
      validationResults: { type: 'array' }
    }
  },

  timeout: 5000,
  optional: false,

  /**
   * Execute the validate trades step
   * @param {Object} context - Pipeline context
   * @returns {Promise<Object>} Validation results
   */
  async execute(context) {
    const { telemetry } = context;
    const { trades } = context.results.parseResponse;
    const { config } = context.results.buildContext;
    const { prices } = context.results.fetchPrices;

    telemetry?.debug('validateTrades', `Validating ${trades.length} trades`);

    // Create validator
    const validator = createDefaultValidator(config);

    // Validation context
    const validationContext = {
      config,
      prices
    };

    const validTrades = [];
    const invalidTrades = [];
    const validationResults = [];

    for (const trade of trades) {
      const result = validator.validate(trade, validationContext);

      validationResults.push({
        tradeId: trade.id,
        asset: trade.asset,
        strategy: trade.strategy,
        valid: result.valid,
        results: result.results
      });

      if (result.valid) {
        // Attach validation results to trade for transparency
        trade.validationResults = result.results;
        validTrades.push(trade);

        telemetry?.debug('validateTrades', `Trade ${trade.asset} passed validation`, {
          results: result.results.map(r => ({ name: r.name, passed: r.passed }))
        });
      } else {
        // Collect failed validations
        const failedValidations = result.results.filter(r => !r.passed);

        invalidTrades.push({
          trade,
          failedValidations
        });

        telemetry?.warn('validateTrades', `Trade ${trade.asset} failed validation`, {
          failures: failedValidations.map(f => f.name)
        });
      }
    }

    telemetry?.info('validateTrades', `Validation complete`, {
      total: trades.length,
      valid: validTrades.length,
      invalid: invalidTrades.length
    });

    // If no valid trades, that's a problem
    if (validTrades.length === 0 && trades.length > 0) {
      telemetry?.error('validateTrades', 'All trades failed validation');
      // Don't throw - let the pipeline continue with empty trades
      // The UI can show the validation failures
    }

    return {
      validTrades,
      invalidTrades,
      validationResults,
      metadata: {
        totalTrades: trades.length,
        validCount: validTrades.length,
        invalidCount: invalidTrades.length,
        validatorCount: validator.getValidatorCount(),
        timestamp: Date.now()
      }
    };
  }
};

// Export utilities
export { createDefaultValidator };

export default validateTradesStep;
