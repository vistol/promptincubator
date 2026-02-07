// Technical Analysis Strategies - Classic trading strategies implemented as pure functions
// Each strategy takes OHLCV candles and returns trade signals

import { Stochastic, EMA, ADX, RSI, BollingerBands, VWAP, MACD } from 'technicalindicators'

/**
 * Common signal structure returned by all strategies
 * @typedef {Object} TradeSignal
 * @property {string} asset
 * @property {'LONG'|'SHORT'} strategy
 * @property {number} entry
 * @property {number} takeProfit
 * @property {number} stopLoss
 * @property {number} time - Entry timestamp
 * @property {string} reason
 */

// Calculate ATR for dynamic TP/SL
const calculateATR = (candles, period = 14) => {
  const trueRanges = []
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trueRanges.push(tr)
  }

  if (trueRanges.length < period) return trueRanges[trueRanges.length - 1] || 0

  const atr = trueRanges.slice(-period).reduce((s, v) => s + v, 0) / period
  return atr
}

// Dynamic TP/SL based on ATR
const calculateLevels = (entry, direction, atr, rrRatio = 2.5) => {
  const slDistance = atr * 1.5
  const tpDistance = slDistance * rrRatio

  if (direction === 'LONG') {
    return {
      takeProfit: entry + tpDistance,
      stopLoss: entry - slDistance
    }
  } else {
    return {
      takeProfit: entry - tpDistance,
      stopLoss: entry + slDistance
    }
  }
}

/**
 * Stochastic Oscillator Strategy (14,3,3)
 * LONG: %K crosses above %D below oversold (20)
 * SHORT: %K crosses below %D above overbought (80)
 */
export const stochasticStrategy = (candles, asset, config = {}) => {
  const { period = 14, signalPeriod = 3, oversold = 20, overbought = 80 } = config
  const signals = []

  if (candles.length < period + signalPeriod + 5) return signals

  const input = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period,
    signalPeriod
  }

  const result = Stochastic.calculate(input)

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1]
    const curr = result[i]
    if (!prev || !curr || prev.k === undefined || curr.k === undefined) continue

    const candleIndex = candles.length - result.length + i
    const candle = candles[candleIndex]
    if (!candle) continue

    const atr = calculateATR(candles.slice(0, candleIndex + 1))
    const entry = candle.close

    // Bullish crossover in oversold zone
    if (prev.k <= prev.d && curr.k > curr.d && curr.k < oversold) {
      const levels = calculateLevels(entry, 'LONG', atr)
      signals.push({
        asset, strategy: 'LONG', entry, ...levels,
        time: candle.time,
        reason: `Stochastic bullish crossover in oversold (K:${curr.k.toFixed(1)}, D:${curr.d.toFixed(1)})`
      })
    }

    // Bearish crossover in overbought zone
    if (prev.k >= prev.d && curr.k < curr.d && curr.k > overbought) {
      const levels = calculateLevels(entry, 'SHORT', atr)
      signals.push({
        asset, strategy: 'SHORT', entry, ...levels,
        time: candle.time,
        reason: `Stochastic bearish crossover in overbought (K:${curr.k.toFixed(1)}, D:${curr.d.toFixed(1)})`
      })
    }
  }

  return signals
}

/**
 * VWAP Strategy
 * LONG: Price crosses above VWAP with volume confirmation
 * SHORT: Price crosses below VWAP with volume confirmation
 */
export const vwapStrategy = (candles, asset, config = {}) => {
  const signals = []
  if (candles.length < 20) return signals

  // Calculate VWAP manually (cumulative)
  let cumVolumePrice = 0
  let cumVolume = 0
  const vwapValues = []

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3
    cumVolumePrice += typicalPrice * candle.volume
    cumVolume += candle.volume
    vwapValues.push(cumVolume > 0 ? cumVolumePrice / cumVolume : candle.close)
  }

  // Calculate average volume for confirmation
  const avgVolume = candles.reduce((s, c) => s + c.volume, 0) / candles.length

  for (let i = 1; i < candles.length; i++) {
    const prevCandle = candles[i - 1]
    const candle = candles[i]
    const prevVwap = vwapValues[i - 1]
    const currVwap = vwapValues[i]

    const atr = calculateATR(candles.slice(0, i + 1))
    const entry = candle.close

    // Volume confirmation: above average
    const volumeConfirm = candle.volume > avgVolume * 1.2
    if (!volumeConfirm) continue

    // Price crosses above VWAP
    if (prevCandle.close <= prevVwap && candle.close > currVwap) {
      const levels = calculateLevels(entry, 'LONG', atr)
      signals.push({
        asset, strategy: 'LONG', entry, ...levels,
        time: candle.time,
        reason: `Price crossed above VWAP ($${currVwap.toFixed(2)}) with ${(candle.volume / avgVolume).toFixed(1)}x avg volume`
      })
    }

    // Price crosses below VWAP
    if (prevCandle.close >= prevVwap && candle.close < currVwap) {
      const levels = calculateLevels(entry, 'SHORT', atr)
      signals.push({
        asset, strategy: 'SHORT', entry, ...levels,
        time: candle.time,
        reason: `Price crossed below VWAP ($${currVwap.toFixed(2)}) with ${(candle.volume / avgVolume).toFixed(1)}x avg volume`
      })
    }
  }

  return signals
}

/**
 * Triple EMA Strategy (5/13/34)
 * LONG: EMA5 > EMA13 > EMA34 (all aligned bullish)
 * SHORT: EMA5 < EMA13 < EMA34 (all aligned bearish)
 */
export const tripleEMAStrategy = (candles, asset, config = {}) => {
  const { fast = 5, mid = 13, slow = 34 } = config
  const signals = []

  if (candles.length < slow + 5) return signals

  const closes = candles.map(c => c.close)
  const emaFast = EMA.calculate({ period: fast, values: closes })
  const emaMid = EMA.calculate({ period: mid, values: closes })
  const emaSlow = EMA.calculate({ period: slow, values: closes })

  // Align arrays (slow EMA has fewest values)
  const offset = closes.length - emaSlow.length
  const fastOffset = emaFast.length - emaSlow.length
  const midOffset = emaMid.length - emaSlow.length

  for (let i = 1; i < emaSlow.length; i++) {
    const prevFast = emaFast[i - 1 + fastOffset]
    const prevMid = emaMid[i - 1 + midOffset]
    const prevSlow = emaSlow[i - 1]

    const currFast = emaFast[i + fastOffset]
    const currMid = emaMid[i + midOffset]
    const currSlow = emaSlow[i]

    const candleIndex = i + offset
    const candle = candles[candleIndex]
    if (!candle) continue

    const atr = calculateATR(candles.slice(0, candleIndex + 1))
    const entry = candle.close

    const wasBullish = prevFast > prevMid && prevMid > prevSlow
    const isBullish = currFast > currMid && currMid > currSlow
    const wasBearish = prevFast < prevMid && prevMid < prevSlow
    const isBearish = currFast < currMid && currMid < currSlow

    // Bullish alignment just formed
    if (!wasBullish && isBullish) {
      const levels = calculateLevels(entry, 'LONG', atr)
      signals.push({
        asset, strategy: 'LONG', entry, ...levels,
        time: candle.time,
        reason: `Triple EMA bullish alignment (${fast}>${mid}>${slow})`
      })
    }

    // Bearish alignment just formed
    if (!wasBearish && isBearish) {
      const levels = calculateLevels(entry, 'SHORT', atr)
      signals.push({
        asset, strategy: 'SHORT', entry, ...levels,
        time: candle.time,
        reason: `Triple EMA bearish alignment (${fast}<${mid}<${slow})`
      })
    }
  }

  return signals
}

/**
 * ADX Trend Strategy
 * LONG: ADX > 25 and +DI > -DI (strong uptrend)
 * SHORT: ADX > 25 and -DI > +DI (strong downtrend)
 */
export const adxTrendStrategy = (candles, asset, config = {}) => {
  const { period = 14, threshold = 25 } = config
  const signals = []

  if (candles.length < period * 2 + 5) return signals

  const input = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period
  }

  const result = ADX.calculate(input)

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1]
    const curr = result[i]
    if (!curr.adx || !curr.pdi || !curr.mdi) continue

    const candleIndex = candles.length - result.length + i
    const candle = candles[candleIndex]
    if (!candle) continue

    const atr = calculateATR(candles.slice(0, candleIndex + 1))
    const entry = candle.close

    // Strong uptrend just formed
    const prevBullish = prev.adx >= threshold && prev.pdi > prev.mdi
    const currBullish = curr.adx >= threshold && curr.pdi > curr.mdi

    if (!prevBullish && currBullish) {
      const levels = calculateLevels(entry, 'LONG', atr)
      signals.push({
        asset, strategy: 'LONG', entry, ...levels,
        time: candle.time,
        reason: `ADX strong uptrend (ADX:${curr.adx.toFixed(1)}, +DI:${curr.pdi.toFixed(1)}, -DI:${curr.mdi.toFixed(1)})`
      })
    }

    // Strong downtrend just formed
    const prevBearish = prev.adx >= threshold && prev.mdi > prev.pdi
    const currBearish = curr.adx >= threshold && curr.mdi > curr.pdi

    if (!prevBearish && currBearish) {
      const levels = calculateLevels(entry, 'SHORT', atr)
      signals.push({
        asset, strategy: 'SHORT', entry, ...levels,
        time: candle.time,
        reason: `ADX strong downtrend (ADX:${curr.adx.toFixed(1)}, -DI:${curr.mdi.toFixed(1)}, +DI:${curr.pdi.toFixed(1)})`
      })
    }
  }

  return signals
}

/**
 * RSI Divergence Strategy
 * LONG: RSI < 30 (oversold) + price making lower lows while RSI makes higher lows
 * SHORT: RSI > 70 (overbought) + price making higher highs while RSI makes lower highs
 */
export const rsiStrategy = (candles, asset, config = {}) => {
  const { period = 14, oversold = 30, overbought = 70 } = config
  const signals = []

  if (candles.length < period + 10) return signals

  const closes = candles.map(c => c.close)
  const rsiValues = RSI.calculate({ period, values: closes })

  const offset = closes.length - rsiValues.length

  for (let i = 5; i < rsiValues.length; i++) {
    const candleIndex = i + offset
    const candle = candles[candleIndex]
    if (!candle) continue

    const rsi = rsiValues[i]
    const prevRsi = rsiValues[i - 3] // Look back 3 periods for divergence
    const price = candle.close
    const prevPrice = candles[candleIndex - 3]?.close
    if (!prevPrice) continue

    const atr = calculateATR(candles.slice(0, candleIndex + 1))
    const entry = candle.close

    // Bullish: RSI oversold + bullish divergence (price lower, RSI higher)
    if (rsi < oversold && price < prevPrice && rsi > prevRsi) {
      const levels = calculateLevels(entry, 'LONG', atr)
      signals.push({
        asset, strategy: 'LONG', entry, ...levels,
        time: candle.time,
        reason: `RSI bullish divergence (RSI:${rsi.toFixed(1)}, oversold with higher RSI low)`
      })
    }

    // Bearish: RSI overbought + bearish divergence (price higher, RSI lower)
    if (rsi > overbought && price > prevPrice && rsi < prevRsi) {
      const levels = calculateLevels(entry, 'SHORT', atr)
      signals.push({
        asset, strategy: 'SHORT', entry, ...levels,
        time: candle.time,
        reason: `RSI bearish divergence (RSI:${rsi.toFixed(1)}, overbought with lower RSI high)`
      })
    }
  }

  return signals
}

/**
 * Bollinger Bands Strategy (20,2)
 * LONG: Price touches lower band + reversal candle
 * SHORT: Price touches upper band + reversal candle
 */
export const bollingerBandsStrategy = (candles, asset, config = {}) => {
  const { period = 20, stdDev = 2 } = config
  const signals = []

  if (candles.length < period + 5) return signals

  const closes = candles.map(c => c.close)
  const bb = BollingerBands.calculate({ period, values: closes, stdDev })

  const offset = closes.length - bb.length

  for (let i = 1; i < bb.length; i++) {
    const candleIndex = i + offset
    const candle = candles[candleIndex]
    const prevCandle = candles[candleIndex - 1]
    if (!candle || !prevCandle) continue

    const bands = bb[i]
    const atr = calculateATR(candles.slice(0, candleIndex + 1))
    const entry = candle.close

    // Reversal candle: close > open (bullish) or close < open (bearish)
    const isBullishCandle = candle.close > candle.open
    const isBearishCandle = candle.close < candle.open

    // Lower band touch + bullish reversal
    if (prevCandle.low <= bands.lower && isBullishCandle && candle.close > bands.lower) {
      const levels = calculateLevels(entry, 'LONG', atr)
      signals.push({
        asset, strategy: 'LONG', entry, ...levels,
        time: candle.time,
        reason: `Bollinger lower band bounce (band:$${bands.lower.toFixed(2)}, reversal candle)`
      })
    }

    // Upper band touch + bearish reversal
    if (prevCandle.high >= bands.upper && isBearishCandle && candle.close < bands.upper) {
      const levels = calculateLevels(entry, 'SHORT', atr)
      signals.push({
        asset, strategy: 'SHORT', entry, ...levels,
        time: candle.time,
        reason: `Bollinger upper band rejection (band:$${bands.upper.toFixed(2)}, reversal candle)`
      })
    }
  }

  return signals
}

/**
 * MACD Crossover Strategy (12,26,9)
 * LONG: MACD line crosses above signal line
 * SHORT: MACD line crosses below signal line
 */
export const macdStrategy = (candles, asset, config = {}) => {
  const { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = config
  const signals = []

  if (candles.length < slowPeriod + signalPeriod + 5) return signals

  const closes = candles.map(c => c.close)
  const result = MACD.calculate({
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  })

  const offset = closes.length - result.length

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1]
    const curr = result[i]
    if (prev.MACD === undefined || curr.MACD === undefined) continue
    if (prev.signal === undefined || curr.signal === undefined) continue

    const candleIndex = i + offset
    const candle = candles[candleIndex]
    if (!candle) continue

    const atr = calculateATR(candles.slice(0, candleIndex + 1))
    const entry = candle.close

    // Bullish crossover
    if (prev.MACD <= prev.signal && curr.MACD > curr.signal) {
      const levels = calculateLevels(entry, 'LONG', atr)
      signals.push({
        asset, strategy: 'LONG', entry, ...levels,
        time: candle.time,
        reason: `MACD bullish crossover (MACD:${curr.MACD.toFixed(4)}, Signal:${curr.signal.toFixed(4)})`
      })
    }

    // Bearish crossover
    if (prev.MACD >= prev.signal && curr.MACD < curr.signal) {
      const levels = calculateLevels(entry, 'SHORT', atr)
      signals.push({
        asset, strategy: 'SHORT', entry, ...levels,
        time: candle.time,
        reason: `MACD bearish crossover (MACD:${curr.MACD.toFixed(4)}, Signal:${curr.signal.toFixed(4)})`
      })
    }
  }

  return signals
}

// Registry of all available strategies
export const STRATEGIES = {
  stochastic: {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    shortName: 'Stochastic',
    description: 'Overbought/oversold crossover signals (14,3,3)',
    params: '(14,3,3)',
    fn: stochasticStrategy,
    icon: '📊'
  },
  vwap: {
    id: 'vwap',
    name: 'Volume Weighted Avg Price',
    shortName: 'VWAP',
    description: 'Price crosses VWAP with volume confirmation',
    params: '',
    fn: vwapStrategy,
    icon: '📈'
  },
  tripleEMA: {
    id: 'tripleEMA',
    name: 'Triple EMA',
    shortName: 'Triple EMA',
    description: 'EMA alignment trend following (5/13/34)',
    params: '(5/13/34)',
    fn: tripleEMAStrategy,
    icon: '📉'
  },
  adx: {
    id: 'adx',
    name: 'ADX Trend',
    shortName: 'ADX',
    description: 'Trend strength with directional movement (14)',
    params: '(14)',
    fn: adxTrendStrategy,
    icon: '💪'
  },
  rsi: {
    id: 'rsi',
    name: 'RSI Divergence',
    shortName: 'RSI',
    description: 'Momentum divergence at extremes (14)',
    params: '(14)',
    fn: rsiStrategy,
    icon: '🔄'
  },
  bollingerBands: {
    id: 'bollingerBands',
    name: 'Bollinger Bands',
    shortName: 'Bollinger',
    description: 'Band touch reversal strategy (20,2)',
    params: '(20,2)',
    fn: bollingerBandsStrategy,
    icon: '🎯'
  },
  macd: {
    id: 'macd',
    name: 'MACD Crossover',
    shortName: 'MACD',
    description: 'Moving average convergence/divergence (12,26,9)',
    params: '(12,26,9)',
    fn: macdStrategy,
    icon: '⚡'
  }
}

/**
 * Run a strategy against historical candle data
 * @param {string} strategyId - Key from STRATEGIES
 * @param {Array} candles - OHLCV array
 * @param {string} asset - Asset symbol
 * @param {Object} config - Strategy-specific config overrides
 * @returns {Array} Trade signals
 */
export const runStrategy = (strategyId, candles, asset, config = {}) => {
  const strategy = STRATEGIES[strategyId]
  if (!strategy) throw new Error(`Unknown strategy: ${strategyId}`)
  return strategy.fn(candles, asset, config)
}
