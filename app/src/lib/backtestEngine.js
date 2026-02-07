// Backtest Engine - Simulates trade signals against historical OHLCV data
// Agnostic to signal source (prompt AI or classic strategy)

/**
 * Simulate a single trade against candle data
 * Walks through candles from entry time to check if TP or SL is hit first
 *
 * @param {Object} trade - { entry, takeProfit, stopLoss, strategy, time }
 * @param {Array} candles - OHLCV candles array
 * @param {Object} config - { slippage, takerFee, leverage }
 * @returns {Object} Trade result
 */
const simulateTrade = (trade, candles, config = {}) => {
  const { slippage = 0.001, takerFee = 0.001, leverage = 1 } = config

  const entry = parseFloat(trade.entry)
  const tp = parseFloat(trade.takeProfit)
  const sl = parseFloat(trade.stopLoss)
  const direction = trade.strategy

  // Apply slippage to entry
  const slippageAmount = entry * slippage
  const adjustedEntry = direction === 'LONG'
    ? entry + slippageAmount  // Worse fill for longs
    : entry - slippageAmount  // Worse fill for shorts

  // Find candles after entry time
  const entryTime = trade.time
  const relevantCandles = candles.filter(c => c.time >= entryTime)

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

  // Walk through candles to find TP/SL hit
  for (let i = 0; i < relevantCandles.length; i++) {
    const candle = relevantCandles[i]

    if (direction === 'LONG') {
      // Check SL first (worst case within same candle)
      if (candle.low <= sl) {
        const exitPrice = sl
        const grossPnl = ((exitPrice - adjustedEntry) / adjustedEntry) * 100
        const fees = (takerFee * 2) * 100 // Entry + exit fees as %
        const netPnl = (grossPnl - fees) * leverage // Deduct fees before leverage (fees apply on notional)

        return {
          ...trade,
          adjustedEntry,
          result: 'loss',
          pnlPercent: netPnl,
          pnlDollar: 0, // Will be calculated with capital
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees
        }
      }
      // Check TP
      if (candle.high >= tp) {
        const exitPrice = tp
        const grossPnl = ((exitPrice - adjustedEntry) / adjustedEntry) * 100
        const fees = (takerFee * 2) * 100
        const netPnl = (grossPnl - fees) * leverage

        return {
          ...trade,
          adjustedEntry,
          result: 'win',
          pnlPercent: netPnl,
          pnlDollar: 0,
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees
        }
      }
    } else {
      // SHORT: Check SL first
      if (candle.high >= sl) {
        const exitPrice = sl
        const grossPnl = ((adjustedEntry - exitPrice) / adjustedEntry) * 100
        const fees = (takerFee * 2) * 100
        const netPnl = (grossPnl - fees) * leverage

        return {
          ...trade,
          adjustedEntry,
          result: 'loss',
          pnlPercent: netPnl,
          pnlDollar: 0,
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees
        }
      }
      // Check TP
      if (candle.low <= tp) {
        const exitPrice = tp
        const grossPnl = ((adjustedEntry - exitPrice) / adjustedEntry) * 100
        const fees = (takerFee * 2) * 100
        const netPnl = (grossPnl - fees) * leverage

        return {
          ...trade,
          adjustedEntry,
          result: 'win',
          pnlPercent: netPnl,
          pnlDollar: 0,
          exitPrice,
          exitTime: candle.time,
          holdingBars: i + 1,
          fees
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
  const fees = (takerFee * 2) * 100
  const netPnl = (unrealizedPnl - fees) * leverage

  return {
    ...trade,
    adjustedEntry,
    result: 'expired',
    pnlPercent: netPnl,
    pnlDollar: 0,
    exitPrice: lastPrice,
    exitTime: lastCandle.time,
    holdingBars: relevantCandles.length,
    fees
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
 * @returns {Object} Backtest results
 */
export const runBacktest = (params) => {
  const {
    trades,
    historicalData,
    initialCapital = 1000,
    leverage = 1,
    slippage = 0.001,
    takerFee = 0.001
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

  const config = { slippage, takerFee, leverage }

  // Simulate each trade
  const results = trades.map(trade => {
    const candles = historicalData[trade.asset]
    if (!candles || candles.length === 0) {
      return { ...trade, result: 'no_data', pnlPercent: 0, pnlDollar: 0 }
    }
    return simulateTrade(trade, candles, config)
  }).filter(t => t.result !== 'no_data')

  // Sort by exit time for equity curve
  results.sort((a, b) => (a.exitTime || 0) - (b.exitTime || 0))

  // Calculate capital per trade
  const capitalPerTrade = initialCapital / Math.max(trades.length, 1)

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

  // Sharpe Ratio (annualized, using per-trade returns with sample variance)
  const tradeReturns = results.map(t => t.pnlPercent)
  const avgReturn = tradeReturns.reduce((s, r) => s + r, 0) / (tradeReturns.length || 1)
  const variance = tradeReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / Math.max(tradeReturns.length - 1, 1)
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0

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
    finalCapital: initialCapital + totalPnlDollar
  }
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
