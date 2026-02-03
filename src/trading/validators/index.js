/**
 * @fileoverview Trade validators and validation orchestrator
 * @module trading/validators
 */

/**
 * TradeValidator - Composable validator chain
 *
 * @example
 * const validator = new TradeValidator()
 *   .add(riskRewardValidator)
 *   .add(priceLevelValidator)
 *   .add(ipeScoreValidator);
 *
 * const result = validator.validate(trade, context);
 * console.log(result.valid, result.results);
 */
export class TradeValidator {
  constructor() {
    this.validators = [];
  }

  /**
   * Add a validator to the chain
   * @param {Object} validator - Validator object
   * @returns {this} For chaining
   */
  add(validator) {
    if (!validator || typeof validator.validate !== 'function') {
      throw new Error('Validator must have a validate method');
    }
    this.validators.push(validator);
    return this;
  }

  /**
   * Remove a validator by name
   * @param {string} name - Validator name
   * @returns {this} For chaining
   */
  remove(name) {
    this.validators = this.validators.filter(v => v.name !== name);
    return this;
  }

  /**
   * Run all validators on a trade
   * @param {Object} trade - Trade to validate
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   */
  validate(trade, context = {}) {
    const results = [];

    for (const validator of this.validators) {
      try {
        const result = validator.validate(trade, context);
        results.push({
          name: validator.name,
          passed: result.passed,
          message: result.message,
          value: result.value,
          threshold: result.threshold,
          severity: validator.severity || 'error'
        });
      } catch (error) {
        results.push({
          name: validator.name,
          passed: false,
          message: `Validator error: ${error.message}`,
          value: null,
          threshold: null,
          severity: 'error'
        });
      }
    }

    // Trade is valid if all non-warning validators pass
    const valid = results
      .filter(r => r.severity === 'error')
      .every(r => r.passed);

    return {
      valid,
      results,
      trade,
      passedCount: results.filter(r => r.passed).length,
      failedCount: results.filter(r => !r.passed).length,
      timestamp: Date.now()
    };
  }

  /**
   * Get number of validators
   * @returns {number} Validator count
   */
  getValidatorCount() {
    return this.validators.length;
  }

  /**
   * Get validator names
   * @returns {string[]} Validator names
   */
  getValidatorNames() {
    return this.validators.map(v => v.name);
  }
}

/**
 * Risk/Reward Ratio Validator
 * Ensures trade has minimum risk/reward ratio
 */
export const riskRewardValidator = {
  name: 'Risk/Reward Ratio',
  severity: 'error',

  validate(trade, context) {
    const { entry, takeProfit, stopLoss, strategy } = trade;
    const minRatio = context.config?.minRiskReward || 2;

    // Calculate reward and risk
    const isLong = strategy === 'LONG';
    const reward = isLong
      ? Math.abs(takeProfit - entry)
      : Math.abs(entry - takeProfit);
    const risk = isLong
      ? Math.abs(entry - stopLoss)
      : Math.abs(stopLoss - entry);

    const ratio = risk > 0 ? reward / risk : 0;

    return {
      passed: ratio >= minRatio,
      message: ratio >= minRatio
        ? `R:R ${ratio.toFixed(2)}:1 meets minimum ${minRatio}:1`
        : `R:R ${ratio.toFixed(2)}:1 below minimum ${minRatio}:1`,
      value: parseFloat(ratio.toFixed(2)),
      threshold: minRatio
    };
  }
};

/**
 * Price Level Validator
 * Ensures TP/SL levels are coherent with trade direction
 */
export const priceLevelValidator = {
  name: 'Price Levels',
  severity: 'error',

  validate(trade, context) {
    const { entry, takeProfit, stopLoss, strategy } = trade;

    // Validate levels are coherent with direction
    let levelsValid;
    let explanation;

    if (strategy === 'LONG') {
      levelsValid = takeProfit > entry && stopLoss < entry;
      explanation = levelsValid
        ? 'LONG: TP above entry, SL below entry'
        : `LONG invalid: TP (${takeProfit}) should be > entry (${entry}), SL (${stopLoss}) should be < entry`;
    } else {
      levelsValid = takeProfit < entry && stopLoss > entry;
      explanation = levelsValid
        ? 'SHORT: TP below entry, SL above entry'
        : `SHORT invalid: TP (${takeProfit}) should be < entry (${entry}), SL (${stopLoss}) should be > entry`;
    }

    return {
      passed: levelsValid,
      message: explanation,
      value: { entry, takeProfit, stopLoss, strategy },
      threshold: 'Coherent with direction'
    };
  }
};

/**
 * IPE Score Validator
 * Validates IPE (Investment Potential Estimate) is within range
 */
export const ipeScoreValidator = {
  name: 'IPE Score',
  severity: 'error',

  validate(trade, context) {
    const { ipe } = trade;
    const minIpe = context.config?.minIpe || 70;
    const maxIpe = 95;

    const inRange = ipe >= minIpe && ipe <= maxIpe;

    return {
      passed: inRange,
      message: inRange
        ? `IPE ${ipe} within acceptable range (${minIpe}-${maxIpe})`
        : `IPE ${ipe} outside range (${minIpe}-${maxIpe})`,
      value: ipe,
      threshold: { min: minIpe, max: maxIpe }
    };
  }
};

/**
 * Leverage Validator
 * Validates leverage is within acceptable limits for the timeframe
 */
export const leverageValidator = {
  name: 'Leverage',
  severity: 'warning',

  validate(trade, context) {
    const { leverage } = trade;
    const executionTime = context.config?.executionTime || 'intraday';

    // Recommended leverage limits by timeframe
    const limits = {
      target: { max: 10, recommended: '1-10x' },
      scalping: { max: 50, recommended: '10-50x' },
      intraday: { max: 20, recommended: '5-20x' },
      swing: { max: 5, recommended: '1-5x' }
    };

    const limit = limits[executionTime] || limits.intraday;
    const withinLimit = leverage <= limit.max;

    return {
      passed: withinLimit,
      message: withinLimit
        ? `Leverage ${leverage}x within ${executionTime} limit (max ${limit.max}x)`
        : `Leverage ${leverage}x exceeds ${executionTime} recommended max ${limit.max}x`,
      value: leverage,
      threshold: { max: limit.max, recommended: limit.recommended }
    };
  }
};

/**
 * Price Deviation Validator
 * Validates entry price is close to current market price
 */
export const priceDeviationValidator = {
  name: 'Entry Price Deviation',
  severity: 'warning',

  validate(trade, context) {
    const { entry, currentPrice, asset } = trade;
    const maxDeviation = context.config?.maxEntryDeviation || 0.05; // 5%

    // Get current price from context if not on trade
    const marketPrice = currentPrice || context.prices?.[asset]?.price;

    if (!marketPrice) {
      return {
        passed: true, // Can't validate without price
        message: 'Cannot validate: current price not available',
        value: null,
        threshold: maxDeviation
      };
    }

    const deviation = Math.abs(entry - marketPrice) / marketPrice;
    const deviationPercent = deviation * 100;
    const withinLimit = deviation <= maxDeviation;

    return {
      passed: withinLimit,
      message: withinLimit
        ? `Entry ${deviationPercent.toFixed(2)}% from current (max ${maxDeviation * 100}%)`
        : `Entry ${deviationPercent.toFixed(2)}% from current exceeds max ${maxDeviation * 100}%`,
      value: parseFloat(deviationPercent.toFixed(2)),
      threshold: maxDeviation * 100
    };
  }
};

/**
 * Volume Validator (optional)
 * Validates asset has sufficient trading volume
 */
export const volumeValidator = {
  name: 'Trading Volume',
  severity: 'warning',

  validate(trade, context) {
    const { asset } = trade;
    const minVolume = context.config?.minVolume || 100000000; // $100M

    const assetData = context.prices?.[asset];
    const volume = assetData?.quoteVolume24h;

    if (!volume) {
      return {
        passed: true,
        message: 'Cannot validate: volume data not available',
        value: null,
        threshold: minVolume
      };
    }

    const sufficient = volume >= minVolume;

    return {
      passed: sufficient,
      message: sufficient
        ? `24h volume $${(volume / 1e6).toFixed(2)}M meets minimum`
        : `24h volume $${(volume / 1e6).toFixed(2)}M below $${(minVolume / 1e6).toFixed(0)}M minimum`,
      value: volume,
      threshold: minVolume
    };
  }
};

/**
 * Create a default validator with standard checks
 * @param {Object} options - Validator options
 * @returns {TradeValidator} Configured validator
 */
export function createStandardValidator(options = {}) {
  const validator = new TradeValidator()
    .add(riskRewardValidator)
    .add(priceLevelValidator)
    .add(ipeScoreValidator);

  if (options.includeLeverage !== false) {
    validator.add(leverageValidator);
  }

  if (options.includePriceDeviation !== false) {
    validator.add(priceDeviationValidator);
  }

  if (options.includeVolume) {
    validator.add(volumeValidator);
  }

  return validator;
}

export default TradeValidator;
