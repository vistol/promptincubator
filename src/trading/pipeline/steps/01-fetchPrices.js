/**
 * @fileoverview Step 1: Fetch real-time prices from exchange
 * @module trading/pipeline/steps/fetchPrices
 */

import { DEFAULT_ASSETS } from '../../types/index.js';

/**
 * Binance API base URL
 */
const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

/**
 * Fetch current prices from Binance
 * @param {string[]} symbols - List of trading pairs
 * @returns {Promise<Object>} Prices map
 */
async function fetchBinancePrices(symbols) {
  const prices = {};

  // Convert symbols to Binance format (BTC/USDT -> BTCUSDT)
  const binanceSymbols = symbols.map(s => s.replace('/', ''));

  try {
    // Fetch all prices in one request
    const response = await fetch(`${BINANCE_API_BASE}/ticker/price`);

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const allPrices = await response.json();

    // Filter and map to our format
    for (const symbol of symbols) {
      const binanceSymbol = symbol.replace('/', '');
      const priceData = allPrices.find(p => p.symbol === binanceSymbol);

      if (priceData) {
        prices[symbol] = {
          price: parseFloat(priceData.price),
          timestamp: Date.now(),
          source: 'binance'
        };
      }
    }

    return prices;
  } catch (error) {
    throw new Error(`Failed to fetch Binance prices: ${error.message}`);
  }
}

/**
 * Fetch 24h statistics from Binance
 * @param {string} symbol - Trading pair
 * @returns {Promise<Object>} 24h stats
 */
async function fetchBinance24hStats(symbol) {
  const binanceSymbol = symbol.replace('/', '');

  try {
    const response = await fetch(
      `${BINANCE_API_BASE}/ticker/24hr?symbol=${binanceSymbol}`
    );

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      volume24h: parseFloat(data.volume),
      quoteVolume24h: parseFloat(data.quoteVolume)
    };
  } catch (error) {
    throw new Error(`Failed to fetch 24h stats for ${symbol}: ${error.message}`);
  }
}

/**
 * Fetch prices step definition
 */
export const fetchPricesStep = {
  name: 'fetchPrices',
  description: 'Fetches real-time prices from Binance exchange',

  inputSchema: {
    type: 'object',
    properties: {
      assets: { type: 'array', items: { type: 'string' } }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      prices: { type: 'object' },
      metadata: { type: 'object' }
    }
  },

  timeout: 15000, // 15 seconds
  retries: 2,
  optional: false,

  /**
   * Execute the fetch prices step
   * @param {Object} context - Pipeline context
   * @returns {Promise<Object>} Prices and metadata
   */
  async execute(context) {
    const { telemetry } = context;
    const config = context.input.config || {};
    const assets = config.assets || DEFAULT_ASSETS;

    telemetry?.debug('fetchPrices', 'Fetching prices for assets', {
      assetsCount: assets.length,
      assets: assets.slice(0, 5) // Log first 5 only
    });

    // Fetch current prices
    const prices = await fetchBinancePrices(assets);
    const fetchedCount = Object.keys(prices).length;

    telemetry?.info('fetchPrices', `Fetched ${fetchedCount} prices`, {
      fetchedCount,
      requestedCount: assets.length
    });

    // Optionally fetch 24h stats for top assets
    const top5Assets = assets.slice(0, 5);
    const stats24h = {};

    try {
      await Promise.all(
        top5Assets.map(async (asset) => {
          if (prices[asset]) {
            const stats = await fetchBinance24hStats(asset);
            stats24h[asset] = stats;
            // Merge stats into price data
            prices[asset] = {
              ...prices[asset],
              ...stats
            };
          }
        })
      );

      telemetry?.debug('fetchPrices', 'Fetched 24h stats for top assets', {
        count: Object.keys(stats24h).length
      });
    } catch (error) {
      // Non-fatal: just log warning
      telemetry?.warn('fetchPrices', 'Failed to fetch 24h stats', {
        error: error.message
      });
    }

    return {
      prices,
      metadata: {
        source: 'binance',
        timestamp: Date.now(),
        assetsRequested: assets.length,
        assetsReceived: fetchedCount,
        missingAssets: assets.filter(a => !prices[a]),
        has24hStats: Object.keys(stats24h).length > 0
      }
    };
  }
};

// Export utilities for external use
export { fetchBinancePrices, fetchBinance24hStats };

export default fetchPricesStep;
