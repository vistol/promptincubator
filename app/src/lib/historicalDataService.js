// Historical Data Service - Fetches and caches OHLCV data from Binance Klines API
// Uses IndexedDB for persistent caching to avoid re-fetching

const BINANCE_API = 'https://api.binance.com/api/v3'
const DB_NAME = 'promptincubator-historical'
const DB_VERSION = 1
const STORE_NAME = 'klines'

// Max candles per Binance request
const MAX_CANDLES_PER_REQUEST = 1000

// Cache TTL: 4 hours — avoid stale price data
const CACHE_TTL_MS = 4 * 60 * 60 * 1000

// Interval mappings
const INTERVAL_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
}

// Open IndexedDB connection
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' })
        store.createIndex('symbol', 'symbol', { unique: false })
        store.createIndex('interval', 'interval', { unique: false })
      }
    }
  })
}

// Generate cache key for a data range
const getCacheKey = (symbol, interval, startTime, endTime) => {
  return `${symbol}-${interval}-${startTime}-${endTime}`
}

// Get cached data from IndexedDB (with TTL check)
const getCachedData = async (symbol, interval, startTime, endTime) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const key = getCacheKey(symbol, interval, startTime, endTime)

    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => {
        const result = request.result
        if (!result?.data) return resolve(null)
        // Check cache TTL — reject stale data
        if (result.cachedAt && (Date.now() - result.cachedAt) > CACHE_TTL_MS) {
          return resolve(null) // Expired, will re-fetch
        }
        resolve(result.data)
      }
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

// Save data to IndexedDB cache
const setCachedData = async (symbol, interval, startTime, endTime, data) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const key = getCacheKey(symbol, interval, startTime, endTime)

    store.put({
      cacheKey: key,
      symbol,
      interval,
      startTime,
      endTime,
      data,
      cachedAt: Date.now()
    })

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('Failed to cache historical data:', err)
  }
}

// Convert Binance symbol format
const toBinanceSymbol = (symbol) => symbol.replace('/', '').toUpperCase()

/**
 * Fetch klines from Binance API for a single chunk
 */
const fetchKlinesChunk = async (symbol, interval, startTime, endTime, limit = MAX_CANDLES_PER_REQUEST) => {
  const binanceSymbol = toBinanceSymbol(symbol)
  const url = `${BINANCE_API}/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Binance Klines API error: ${response.status}`)
  }

  const raw = await response.json()

  // Parse Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
  return raw.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
    quoteVolume: parseFloat(k[7]),
    trades: k[8]
  }))
}

/**
 * Fetch historical OHLCV data with automatic pagination
 * @param {string} symbol - e.g. 'BTC/USDT'
 * @param {string} interval - '1m', '5m', '15m', '1h', '4h', '1d'
 * @param {number} startTime - Start timestamp in ms
 * @param {number} endTime - End timestamp in ms
 * @param {function} onProgress - Optional progress callback (loaded, total)
 * @returns {Array} Array of OHLCV candles
 */
export const fetchHistoricalData = async (symbol, interval, startTime, endTime, onProgress) => {
  // Round times to interval boundaries
  const intervalMs = INTERVAL_MS[interval]
  if (!intervalMs) throw new Error(`Unsupported interval: ${interval}`)

  const roundedStart = Math.floor(startTime / intervalMs) * intervalMs
  const roundedEnd = Math.floor(endTime / intervalMs) * intervalMs

  // Check cache first
  const cached = await getCachedData(symbol, interval, roundedStart, roundedEnd)
  if (cached && cached.length > 0) {
    onProgress?.(cached.length, cached.length)
    return cached
  }

  // Calculate total expected candles
  const totalExpected = Math.ceil((roundedEnd - roundedStart) / intervalMs)

  // Fetch in chunks
  const allCandles = []
  let currentStart = roundedStart

  while (currentStart < roundedEnd) {
    const chunk = await fetchKlinesChunk(symbol, interval, currentStart, roundedEnd)

    if (chunk.length === 0) break

    allCandles.push(...chunk)
    onProgress?.(allCandles.length, totalExpected)

    // Move start to after the last candle
    currentStart = chunk[chunk.length - 1].time + intervalMs

    // Rate limiting: wait 100ms between requests
    if (currentStart < roundedEnd) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  // Deduplicate by time
  const seen = new Set()
  const deduped = allCandles.filter(c => {
    if (seen.has(c.time)) return false
    seen.add(c.time)
    return true
  }).sort((a, b) => a.time - b.time)

  // Cache the result
  if (deduped.length > 0) {
    await setCachedData(symbol, interval, roundedStart, roundedEnd, deduped)
  }

  return deduped
}

/**
 * Fetch historical data for multiple symbols
 */
export const fetchMultiSymbolData = async (symbols, interval, startTime, endTime, onProgress) => {
  const results = {}
  let completed = 0

  for (const symbol of symbols) {
    results[symbol] = await fetchHistoricalData(
      symbol, interval, startTime, endTime,
      (loaded, total) => {
        onProgress?.(symbol, loaded, total, completed, symbols.length)
      }
    )
    completed++
  }

  return results
}

/**
 * Get available date range for a symbol (earliest data to now)
 */
export const getAvailableRange = async (symbol) => {
  try {
    const binanceSymbol = toBinanceSymbol(symbol)
    const url = `${BINANCE_API}/klines?symbol=${binanceSymbol}&interval=1M&limit=1`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch')

    const data = await response.json()
    if (data.length > 0) {
      return {
        earliest: data[0][0],
        latest: Date.now()
      }
    }
  } catch {
    return { earliest: Date.now() - 180 * 24 * 60 * 60 * 1000, latest: Date.now() }
  }
}

/**
 * Clear cached data older than maxAge
 */
export const clearOldCache = async (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const cutoff = Date.now() - maxAgeMs

    const request = store.openCursor()
    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        if (cursor.value.cachedAt < cutoff) {
          cursor.delete()
        }
        cursor.continue()
      }
    }
  } catch (err) {
    console.warn('Failed to clear old cache:', err)
  }
}

/**
 * Get prices at a specific point in time from historical data
 */
export const getPricesAtTime = (historicalData, targetTime) => {
  const prices = {}

  for (const [symbol, candles] of Object.entries(historicalData)) {
    // Find the candle that contains the target time
    const candle = candles.find(c => c.time <= targetTime && c.closeTime >= targetTime)
    if (candle) {
      prices[symbol] = candle.close
    } else if (candles.length > 0) {
      // Use the closest candle before target time
      const before = candles.filter(c => c.time <= targetTime)
      if (before.length > 0) {
        prices[symbol] = before[before.length - 1].close
      }
    }
  }

  return prices
}

export { INTERVAL_MS }
