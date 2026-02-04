// Price Service for fetching real-time prices from trading platforms

const BINANCE_API = 'https://api.binance.com/api/v3'
const TRADINGVIEW_API = 'https://scanner.tradingview.com/crypto/scan'

// Map common symbols to Binance format
const toBinanceSymbol = (symbol) => {
  // Remove slashes and convert to uppercase
  return symbol.replace('/', '').toUpperCase()
}

// Map common symbols to TradingView format
const toTradingViewSymbol = (symbol) => {
  // TradingView uses BINANCE:BTCUSDT format
  return `BINANCE:${symbol.replace('/', '').toUpperCase()}`
}

/**
 * Fetch price from Binance API
 */
export const fetchBinancePrice = async (symbol) => {
  try {
    const binanceSymbol = toBinanceSymbol(symbol)
    const response = await fetch(`${BINANCE_API}/ticker/price?symbol=${binanceSymbol}`)

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      symbol,
      price: parseFloat(data.price),
      source: 'binance',
      timestamp: Date.now()
    }
  } catch (error) {
    console.error(`Binance fetch error for ${symbol}:`, error)
    throw error
  }
}

/**
 * Fetch multiple prices from Binance API
 */
export const fetchBinancePrices = async (symbols) => {
  try {
    // Fetch all ticker prices at once
    const response = await fetch(`${BINANCE_API}/ticker/price`)

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }

    const allPrices = await response.json()
    const priceMap = {}

    // Create a map of all prices
    allPrices.forEach(item => {
      priceMap[item.symbol] = parseFloat(item.price)
    })

    // Extract requested symbols
    const results = {}
    symbols.forEach(symbol => {
      const binanceSymbol = toBinanceSymbol(symbol)
      if (priceMap[binanceSymbol]) {
        results[symbol] = {
          symbol,
          price: priceMap[binanceSymbol],
          source: 'binance',
          timestamp: Date.now()
        }
      }
    })

    return results
  } catch (error) {
    console.error('Binance bulk fetch error:', error)
    throw error
  }
}

/**
 * Fetch 24h ticker stats from Binance
 */
export const fetchBinance24hStats = async (symbol) => {
  try {
    const binanceSymbol = toBinanceSymbol(symbol)
    const response = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${binanceSymbol}`)

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      symbol,
      price: parseFloat(data.lastPrice),
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      volume24h: parseFloat(data.volume),
      quoteVolume24h: parseFloat(data.quoteVolume),
      source: 'binance',
      timestamp: Date.now()
    }
  } catch (error) {
    console.error(`Binance 24h stats error for ${symbol}:`, error)
    throw error
  }
}

/**
 * Fetch price from TradingView (via scanner API)
 * Note: TradingView doesn't have a public API, this uses their scanner endpoint
 */
export const fetchTradingViewPrice = async (symbol) => {
  try {
    const tvSymbol = toTradingViewSymbol(symbol)

    const response = await fetch(TRADINGVIEW_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbols: { tickers: [tvSymbol], query: { types: [] } },
        columns: ['close', 'change', 'change_abs', 'high', 'low', 'volume']
      })
    })

    if (!response.ok) {
      throw new Error(`TradingView API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.data && data.data.length > 0) {
      const [close, change, changeAbs, high, low, volume] = data.data[0].d
      return {
        symbol,
        price: close,
        priceChangePercent: change,
        priceChange: changeAbs,
        high24h: high,
        low24h: low,
        volume24h: volume,
        source: 'tradingview',
        timestamp: Date.now()
      }
    }

    throw new Error('No data returned from TradingView')
  } catch (error) {
    console.error(`TradingView fetch error for ${symbol}:`, error)
    throw error
  }
}

/**
 * Fetch multiple prices from TradingView
 */
export const fetchTradingViewPrices = async (symbols) => {
  try {
    const tvSymbols = symbols.map(s => toTradingViewSymbol(s))

    const response = await fetch(TRADINGVIEW_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbols: { tickers: tvSymbols, query: { types: [] } },
        columns: ['close', 'change', 'change_abs', 'high', 'low', 'volume']
      })
    })

    if (!response.ok) {
      throw new Error(`TradingView API error: ${response.status}`)
    }

    const data = await response.json()
    const results = {}

    if (data.data) {
      data.data.forEach((item, index) => {
        const symbol = symbols[index]
        const [close, change, changeAbs, high, low, volume] = item.d
        results[symbol] = {
          symbol,
          price: close,
          priceChangePercent: change,
          priceChange: changeAbs,
          high24h: high,
          low24h: low,
          volume24h: volume,
          source: 'tradingview',
          timestamp: Date.now()
        }
      })
    }

    return results
  } catch (error) {
    console.error('TradingView bulk fetch error:', error)
    throw error
  }
}

/**
 * Main price fetcher with fallback support
 */
export const fetchPrices = async (symbols, primaryPlatform = 'binance', fallbackPlatform = 'tradingview') => {
  const platforms = {
    binance: fetchBinancePrices,
    tradingview: fetchTradingViewPrices
  }

  try {
    // Try primary platform
    const primaryFetcher = platforms[primaryPlatform]
    if (primaryFetcher) {
      const prices = await primaryFetcher(symbols)
      return { prices, source: primaryPlatform, error: null }
    }
  } catch (primaryError) {
    console.warn(`Primary platform (${primaryPlatform}) failed:`, primaryError)

    // Try fallback platform
    try {
      const fallbackFetcher = platforms[fallbackPlatform]
      if (fallbackFetcher) {
        const prices = await fallbackFetcher(symbols)
        return { prices, source: fallbackPlatform, error: null, fallbackUsed: true }
      }
    } catch (fallbackError) {
      console.error(`Fallback platform (${fallbackPlatform}) also failed:`, fallbackError)
      return {
        prices: {},
        source: null,
        error: `Both platforms failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
      }
    }
  }

  return { prices: {}, source: null, error: 'No valid platform configured' }
}

/**
 * Fetch single price with fallback
 */
export const fetchPrice = async (symbol, primaryPlatform = 'binance', fallbackPlatform = 'tradingview') => {
  const platforms = {
    binance: fetchBinancePrice,
    tradingview: fetchTradingViewPrice
  }

  try {
    const primaryFetcher = platforms[primaryPlatform]
    if (primaryFetcher) {
      return await primaryFetcher(symbol)
    }
  } catch (primaryError) {
    console.warn(`Primary platform (${primaryPlatform}) failed for ${symbol}:`, primaryError)

    try {
      const fallbackFetcher = platforms[fallbackPlatform]
      if (fallbackFetcher) {
        const result = await fallbackFetcher(symbol)
        return { ...result, fallbackUsed: true }
      }
    } catch (fallbackError) {
      console.error(`Fallback also failed for ${symbol}:`, fallbackError)
      throw new Error(`Failed to fetch price for ${symbol}`)
    }
  }

  throw new Error('No valid platform configured')
}

/**
 * Get list of supported trading pairs
 */
export const SUPPORTED_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'AVAX/USDT',
  'DOT/USDT',
  'MATIC/USDT',
  'LINK/USDT',
  'UNI/USDT',
  'ATOM/USDT',
  'LTC/USDT',
  'ETC/USDT',
  'XLM/USDT',
  'ALGO/USDT',
  'VET/USDT',
  'FTM/USDT',
  'NEAR/USDT',
  'APT/USDT',
  'ARB/USDT',
  'OP/USDT',
  'INJ/USDT',
  'SUI/USDT'
]

/**
 * Calculate trade status based on current price
 */
export const calculateTradeStatus = (trade, currentPrice) => {
  if (!currentPrice || !trade.entry) return { status: 'pending', pnlPercent: 0 }

  const entry = parseFloat(trade.entry)
  const tp = parseFloat(trade.takeProfit)
  const sl = parseFloat(trade.stopLoss)
  const price = currentPrice

  if (trade.strategy === 'LONG') {
    // LONG: win if price >= TP, loss if price <= SL
    if (price >= tp) {
      return {
        status: 'win',
        pnlPercent: ((tp - entry) / entry) * 100,
        exitPrice: tp
      }
    } else if (price <= sl) {
      return {
        status: 'loss',
        pnlPercent: ((sl - entry) / entry) * 100,
        exitPrice: sl
      }
    } else {
      return {
        status: 'active',
        pnlPercent: ((price - entry) / entry) * 100,
        currentPrice: price
      }
    }
  } else {
    // SHORT: win if price <= TP, loss if price >= SL
    if (price <= tp) {
      return {
        status: 'win',
        pnlPercent: ((entry - tp) / entry) * 100,
        exitPrice: tp
      }
    } else if (price >= sl) {
      return {
        status: 'loss',
        pnlPercent: ((entry - sl) / entry) * 100,
        exitPrice: sl
      }
    } else {
      return {
        status: 'active',
        pnlPercent: ((entry - price) / entry) * 100,
        currentPrice: price
      }
    }
  }
}

/**
 * Calculate PnL in USD
 */
export const calculatePnL = (trade, currentPrice, capital) => {
  const status = calculateTradeStatus(trade, currentPrice)
  const tradeCapital = capital / (trade.totalTrades || 1)
  return (status.pnlPercent / 100) * tradeCapital
}
