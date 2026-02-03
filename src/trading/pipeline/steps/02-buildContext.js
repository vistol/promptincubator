/**
 * @fileoverview Step 2: Build trading context from prices and config
 * @module trading/pipeline/steps/buildContext
 */

import { EXECUTION_LIMITS, DEFAULT_CONFIG } from '../../types/index.js';

/**
 * Analyze market conditions from price data
 * @param {Object} prices - Price data
 * @returns {Object} Market analysis
 */
function analyzeMarketConditions(prices) {
  const analysis = {
    topGainers: [],
    topLosers: [],
    highVolume: [],
    nearSupport: [],
    nearResistance: [],
    averageChange: 0
  };

  const priceEntries = Object.entries(prices);

  // Calculate average 24h change
  const changes = priceEntries
    .filter(([_, data]) => data.priceChangePercent !== undefined)
    .map(([_, data]) => data.priceChangePercent);

  if (changes.length > 0) {
    analysis.averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  // Sort by 24h change
  const sortedByChange = priceEntries
    .filter(([_, data]) => data.priceChangePercent !== undefined)
    .sort((a, b) => b[1].priceChangePercent - a[1].priceChangePercent);

  // Top 3 gainers and losers
  analysis.topGainers = sortedByChange.slice(0, 3).map(([symbol, data]) => ({
    symbol,
    change: data.priceChangePercent
  }));

  analysis.topLosers = sortedByChange.slice(-3).reverse().map(([symbol, data]) => ({
    symbol,
    change: data.priceChangePercent
  }));

  // High volume assets (if volume data available)
  analysis.highVolume = priceEntries
    .filter(([_, data]) => data.quoteVolume24h > 1000000000) // > $1B volume
    .map(([symbol, data]) => ({
      symbol,
      volume: data.quoteVolume24h
    }))
    .slice(0, 5);

  // Near 24h support/resistance
  priceEntries.forEach(([symbol, data]) => {
    if (data.high24h && data.low24h && data.price) {
      const range = data.high24h - data.low24h;
      const positionInRange = (data.price - data.low24h) / range;

      if (positionInRange < 0.2) {
        analysis.nearSupport.push({
          symbol,
          distancePercent: ((data.price - data.low24h) / data.low24h) * 100
        });
      } else if (positionInRange > 0.8) {
        analysis.nearResistance.push({
          symbol,
          distancePercent: ((data.high24h - data.price) / data.price) * 100
        });
      }
    }
  });

  return analysis;
}

/**
 * Calculate position sizing based on config
 * @param {Object} config - Trade configuration
 * @returns {Object} Position sizing details
 */
function calculatePositionSizing(config) {
  const { capital, leverage, numResults } = config;

  const capitalPerTrade = capital / numResults;
  const effectiveCapital = capitalPerTrade * leverage;
  const maxRiskPerTrade = capitalPerTrade * 0.02; // 2% risk per trade

  return {
    totalCapital: capital,
    capitalPerTrade,
    effectiveCapital,
    leverage,
    maxRiskPerTrade,
    maxRiskPercent: 2,
    numTrades: numResults
  };
}

/**
 * Determine execution parameters based on timeframe
 * @param {string} executionTime - Execution timeframe
 * @param {number} targetPct - Target percentage
 * @returns {Object} Execution parameters
 */
function getExecutionParameters(executionTime, targetPct) {
  const baseParams = {
    timeframe: executionTime,
    maxDuration: EXECUTION_LIMITS[executionTime],
    targetPercent: targetPct
  };

  switch (executionTime) {
    case 'target':
      return {
        ...baseParams,
        description: 'Target-based: No time limit, closes on TP or SL only',
        minRiskReward: 2,
        suggestedLeverage: '1-10x',
        chartTimeframes: ['4h', '1d']
      };

    case 'scalping':
      return {
        ...baseParams,
        description: 'Scalping: Quick trades within 1 hour',
        minRiskReward: 1.5,
        suggestedLeverage: '10-50x',
        chartTimeframes: ['1m', '5m', '15m'],
        maxPositionTime: '1 hour'
      };

    case 'intraday':
      return {
        ...baseParams,
        description: 'Intraday: Trades closed within 24 hours',
        minRiskReward: 2,
        suggestedLeverage: '5-20x',
        chartTimeframes: ['15m', '1h', '4h'],
        maxPositionTime: '24 hours'
      };

    case 'swing':
      return {
        ...baseParams,
        description: 'Swing trading: Positions held up to 7 days',
        minRiskReward: 2.5,
        suggestedLeverage: '1-5x',
        chartTimeframes: ['4h', '1d', '1w'],
        maxPositionTime: '7 days'
      };

    default:
      return baseParams;
  }
}

/**
 * Build context step definition
 */
export const buildContextStep = {
  name: 'buildContext',
  description: 'Builds trading context from prices and configuration',

  inputSchema: {
    type: 'object',
    required: ['fetchPrices'],
    properties: {
      fetchPrices: { type: 'object' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      marketAnalysis: { type: 'object' },
      positionSizing: { type: 'object' },
      executionParams: { type: 'object' },
      pricesSummary: { type: 'object' }
    }
  },

  timeout: 5000,
  optional: false,

  /**
   * Execute the build context step
   * @param {Object} context - Pipeline context
   * @returns {Promise<Object>} Trading context
   */
  async execute(context) {
    const { telemetry } = context;
    const { prices, metadata: priceMetadata } = context.results.fetchPrices;
    const config = { ...DEFAULT_CONFIG, ...context.input.config };

    telemetry?.debug('buildContext', 'Building trading context', {
      pricesCount: Object.keys(prices).length,
      config: {
        executionTime: config.executionTime,
        capital: config.capital,
        leverage: config.leverage
      }
    });

    // Analyze market conditions
    const marketAnalysis = analyzeMarketConditions(prices);

    telemetry?.info('buildContext', 'Market analysis complete', {
      topGainers: marketAnalysis.topGainers.length,
      topLosers: marketAnalysis.topLosers.length,
      averageChange: marketAnalysis.averageChange.toFixed(2)
    });

    // Calculate position sizing
    const positionSizing = calculatePositionSizing(config);

    // Get execution parameters
    const executionParams = getExecutionParameters(
      config.executionTime,
      config.targetPct
    );

    // Create prices summary for prompt
    const pricesSummary = Object.entries(prices)
      .map(([symbol, data]) => ({
        symbol,
        price: data.price,
        change24h: data.priceChangePercent,
        high24h: data.high24h,
        low24h: data.low24h,
        volume24h: data.quoteVolume24h
      }))
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

    return {
      marketAnalysis,
      positionSizing,
      executionParams,
      pricesSummary,
      config,
      priceMetadata,
      timestamp: Date.now()
    };
  }
};

// Export utilities
export { analyzeMarketConditions, calculatePositionSizing, getExecutionParameters };

export default buildContextStep;
