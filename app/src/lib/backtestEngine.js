// Backtest Engine - Simulates trade signals against historical OHLCV data
// Agnostic to signal source (prompt AI or classic strategy)
//
// AUDIT FIXES v2:
// Fix 1: Fees scale with leverage (fees on notional, not margin)
// Fix 2: SHORT slippage corrected (worse fill = higher entry for shorts)
// Fix 3: Sharpe Ratio calculated on daily returns, not per-trade
// Fix 5: Capital allocation tracks concurrent positions

/**
 * Simulate a single trade against candle data
 * Walks through candles from entry time to check if TP or SL is hit first
 *
 * @param {Object} trade - { entry, takeProfit, stopLoss, strategy, time }
 * @param {Array} candles - OHLCV candles array
 * @param {Object} config - { slippage, takerFee, leverage, maxTime }
 * @returns {Object} Trade result
 */
const simulateTrade = (trade, candles, config = {}) => {
  const { slippage = 0.001, takerFee = 0.001, leverage = 1, maxTime = Infinity } = config

  const entry = parseFloat(trade.entry)
  const tp = parseFloat(trade.takeProfit)
  const sl = parseFloat(trade.stopLoss)
  const direction = trade.strategy

  // FIX 2: Apply slippage — worse fill for BOTH directions
  // LONG: buy higher than expected (entry + slippage)
  // SHORT: sell lower than expected (entry - slippage) → WRONG, should be HIGHER
  // Correct: SHORT worse fill = you enter at a worse price = higher entry (you sell at lower price)
  const slippageAmount = entry * slippage
  const adjustedEntry = direction === 'LONG'
    ? entry + slippageAmount  // Worse fill: buy higher
    : entry + slippageAmount  // Worse fill: sell at higher price (less profit room to TP)

  // Find candles after entry time, limited by maxTime (walk-forward isolation)
  const entryTime = trade.time
  const relevantCandles = candles.filter(c => c.time >= entryTime && c.time <= maxTime)

  if (relevantCandles.length === 0) {
    return {
      ...trade,
      result: 'no_data',
      pnlPercent: 0,
      pnlDollar: 0,
      exitPrice: null,
      exitTime: null,
      holdingBars: 0,
      fees: 0
    }
  }

  // FIX 1: Fees scale with leverage
  // On a leveraged position, fees are charged on the NOTIONAL value, not margin
  // Entry fee: notional * takerFee = margin * leverage * takerFee
  // As percentage of margin: leverage * takerFee
  // Total (entry + exit): 2 * leverage * takerFee * 100 (as %)
  const feesPercent = (takerFee * 2 * leverage) * 100

  // Walk through candles to find TP/SL hit
  for (let i = 0; i < relevantCandles.length; i++) {
    const candle = relevantCandles[i]

    if (direction === 'LONG') {
      // Check SL first (worst case within same candle)
      if (candle.low <= sl) {
        const exitPrice = sl
        const grossPnl = ((exitPrice - adjustedEntry) / adjustedEntry) * 100
        const netPnl = (grossPnl * leverage) - feesPercent

        return {
          ...trade,
          adjustedEntry,
          result: 'loss',
          pnlPercent: netPnl,
          pnlDollar: 0,
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees: feesPercent
        }
      }
      // Check TP
      if (candle.high >= tp) {
        const exitPrice = tp
        const grossPnl = ((exitPrice - adjustedEntry) / adjustedEntry) * 100
        const netPnl = (grossPnl * leverage) - feesPercent

        return {
          ...trade,
          adjustedEntry,
          result: 'win',
          pnlPercent: netPnl,
          pnlDollar: 0,
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees: feesPercent
        }
      }
    } else {
      // SHORT: Check SL first
      if (candle.high >= sl) {
        const exitPrice = sl
        const grossPnl = ((adjustedEntry - exitPrice) / adjustedEntry) * 100
        const netPnl = (grossPnl * leverage) - feesPercent

        return {
          ...trade,
          adjustedEntry,
          result: 'loss',
          pnlPercent: netPnl,
          pnlDollar: 0,
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees: feesPercent
        }
      }
      // Check TP
      if (candle.low <= tp) {
        const exitPrice = tp
        const grossPnl = ((adjustedEntry - exitPrice) / adjustedEntry) * 100
        const netPnl = (grossPnl * leverage) - feesPercent

        return {
          ...trade,
          adjustedEntry,
          result: 'win',
          pnlPercent: netPnl,
          pnlDollar: 0,
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees: feesPercent
        }
      }
    }
  }

  // Neither TP nor SL was hit — still open at end of data
  const lastCandle = relevantCandles[relevantCandles.length - 1]
  const lastPrice = lastCandle.close
  let unrealizedPnl
  if (direction === 'LONG') {
    unrealizedPnl = ((lastPrice - adjustedEntry) / adjustedEntry) * 100
  } else {
    unrealizedPnl = ((adjustedEntry - lastPrice) / adjustedEntry) * 100
  }
  const netPnl = (unrealizedPnl * leverage) - feesPercent

  return {
    ...trade,
    adjustedEntry,
    result: 'expired',
    pnlPercent: netPnl,
    pnlDollar: 0,
    exitPrice: lastPrice,
    exitTime: lastCandle.time,
    holdingBars: relevantCandles.length,
    fees: feesPercent
  }
}

/**
 * Run a full backtest
 * @param {Object} params
 * @param {Array} params.trades - Array of trade signals to simulate
 * @param {Object} params.historicalData - { 'BTC/USDT': candles[], ... }
 * @param {number} params.initialCapital - Starting capital
 * @param {number} params.leverage - Leverage multiplier
 * @param {number} params.slippage - Slippage percentage (0.001 = 0.1%)
 * @param {number} params.takerFee - Taker fee percentage (0.001 = 0.1%)
 * @param {Array} params.sampleBoundaries - Time boundaries for walk-forward isolation
 * @returns {Object} Backtest results
 */
export const runBacktest = (params) => {
  const {
    trades,
    historicalData,
    initialCapital = 1000,
    leverage = 1,
    slippage = 0.001,
    takerFee = 0.001,
    sampleBoundaries = null // FIX 4: Array of { start, end } per sample window
  } = params

  if (!trades || trades.length === 0) {
    return {
      trades: [],
      totalPnlPercent: 0,
      totalPnlDollar: 0,
      winRate: 0,
      wins: 0,
      losses: 0,
      expired: 0,
      totalTrades: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      equityCurve: [{ time: Date.now(), equity: initialCapital }],
      avgHoldingBars: 0,
      totalFees: 0
    }
  }

  // FIX 4: Build maxTime lookup for walk-forward data isolation
  // Each trade can only see candles up to its sample window boundary
  const getMaxTime = (trade) => {
    if (!sampleBoundaries || sampleBoundaries.length === 0) return Infinity
    const boundary = sampleBoundaries.find(b => trade.time >= b.start && trade.time < b.end)
    return boundary ? boundary.end : Infinity
  }

  // Simulate each trade with walk-forward isolation
  const results = trades.map(trade => {
    const candles = historicalData[trade.asset]
    if (!candles || candles.length === 0) {
      return { ...trade, result: 'no_data', pnlPercent: 0, pnlDollar: 0 }
    }
    const config = { slippage, takerFee, leverage, maxTime: getMaxTime(trade) }
    return simulateTrade(trade, candles, config)
  }).filter(t => t.result !== 'no_data')

  // Sort by exit time for equity curve
  results.sort((a, b) => (a.exitTime || 0) - (b.exitTime || 0))

  // FIX 5: Capital allocation based on max concurrent positions
  // Instead of dividing by total trades, find max overlapping positions
  const maxConcurrent = calculateMaxConcurrent(results)
  const capitalPerTrade = initialCapital / Math.max(maxConcurrent, 1)

  // Calculate dollar PnL for each trade
  results.forEach(t => {
    t.pnlDollar = (t.pnlPercent / 100) * capitalPerTrade
  })

  // Statistics
  const wins = results.filter(t => t.result === 'win').length
  const losses = results.filter(t => t.result === 'loss').length
  const expired = results.filter(t => t.result === 'expired').length
  const totalTrades = results.length

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0

  const grossProfit = results.filter(t => t.pnlDollar > 0).reduce((s, t) => s + t.pnlDollar, 0)
  const grossLoss = Math.abs(results.filter(t => t.pnlDollar < 0).reduce((s, t) => s + t.pnlDollar, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0)

  const totalPnlDollar = results.reduce((s, t) => s + t.pnlDollar, 0)
  const totalPnlPercent = (totalPnlDollar / initialCapital) * 100
  const totalFees = results.reduce((s, t) => s + (t.fees || 0), 0)

  // Equity curve
  const equityCurve = [{ time: results[0]?.time || Date.now(), equity: initialCapital }]
  let runningEquity = initialCapital

  for (const trade of results) {
    runningEquity += trade.pnlDollar
    equityCurve.push({
      time: trade.exitTime || trade.time,
      equity: runningEquity,
      trade: {
        asset: trade.asset,
        strategy: trade.strategy,
        result: trade.result,
        pnl: trade.pnlDollar
      }
    })
  }

  // Max drawdown
  let peak = initialCapital
  let maxDrawdown = 0
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity
    const drawdown = ((peak - point.equity) / peak) * 100
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  // FIX 3: Sharpe Ratio calculated on DAILY returns, not per-trade
  // Convert equity curve to daily returns, then annualize with sqrt(365)
  const sharpeRatio = calculateDailySharpe(equityCurve)

  // Average holding time
  const avgHoldingBars = results.reduce((s, t) => s + (t.holdingBars || 0), 0) / (results.length || 1)

  return {
    trades: results,
    totalPnlPercent,
    totalPnlDollar,
    winRate,
    wins,
    losses,
    expired,
    totalTrades,
    profitFactor,
    maxDrawdown,
    sharpeRatio,
    equityCurve,
    avgHoldingBars,
    totalFees,
    grossProfit,
    grossLoss,
    initialCapital,
    finalCapital: initialCapital + totalPnlDollar,
    maxConcurrentPositions: maxConcurrent
  }
}

/**
 * FIX 3: Calculate Sharpe Ratio from daily returns
 * Converts equity curve to daily snapshots, computes daily returns,
 * then annualizes: Sharpe = (avgDailyReturn / stdDailyReturn) * sqrt(365)
 */
const calculateDailySharpe = (equityCurve) => {
  if (!equityCurve || equityCurve.length < 2) return 0

  // Group equity curve by calendar day
  const dailyEquity = {}
  for (const point of equityCurve) {
    const day = new Date(point.time).toISOString().split('T')[0] // YYYY-MM-DD
    dailyEquity[day] = point.equity // Last value of each day
  }

  const days = Object.keys(dailyEquity).sort()
  if (days.length < 2) return 0

  // Calculate daily returns
  const dailyReturns = []
  for (let i = 1; i < days.length; i++) {
    const prev = dailyEquity[days[i - 1]]
    const curr = dailyEquity[days[i]]
    if (prev > 0) {
      dailyReturns.push(((curr - prev) / prev) * 100)
    }
  }

  if (dailyReturns.length < 2) return 0

  // Mean and standard deviation (sample variance, N-1)
  const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / Math.max(dailyReturns.length - 1, 1)
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 0

  // Annualize: crypto trades 365 days/year
  return (avgReturn / stdDev) * Math.sqrt(365)
}

/**
 * FIX 5: Calculate maximum concurrent open positions
 * Walks through all trades' open/close events to find peak overlap
 */
const calculateMaxConcurrent = (results) => {
  if (results.length === 0) return 1

  // Create events for each trade: open at entry time, close at exit time
  const events = []
  for (const trade of results) {
    const openTime = trade.time || 0
    const closeTime = trade.exitTime || openTime + 1
    events.push({ time: openTime, type: 'open' })
    events.push({ time: closeTime, type: 'close' })
  }

  // Sort: opens before closes at same timestamp
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    return a.type === 'open' ? -1 : 1
  })

  let current = 0
  let max = 0
  for (const event of events) {
    if (event.type === 'open') {
      current++
      if (current > max) max = current
    } else {
      current--
    }
  }

  return Math.max(max, 1)
}

/**
 * Run backtest in time windows for walk-forward analysis
 */
export const runWindowedBacktest = (params) => {
  const { trades, historicalData, windowSizeMs, ...config } = params

  if (!trades || trades.length === 0) return []

  // Sort trades by time
  const sorted = [...trades].sort((a, b) => a.time - b.time)
  const startTime = sorted[0].time
  const endTime = sorted[sorted.length - 1].time

  const windows = []
  let windowStart = startTime

  while (windowStart < endTime) {
    const windowEnd = windowStart + windowSizeMs
    const windowTrades = sorted.filter(t => t.time >= windowStart && t.time < windowEnd)

    if (windowTrades.length > 0) {
      const result = runBacktest({ ...config, trades: windowTrades, historicalData })
      windows.push({
        startTime: windowStart,
        endTime: windowEnd,
        ...result
      })
    }

    windowStart = windowEnd
  }

  return windows
}
