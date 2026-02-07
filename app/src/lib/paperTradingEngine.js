// Paper Trading Engine - Virtual portfolio management with live price tracking
// Extends the existing egg/signal system with portfolio-level tracking

/**
 * Create a new virtual portfolio
 */
export const createPortfolio = (initialBalance = 10000) => ({
  id: `portfolio-${Date.now()}`,
  initialBalance,
  balance: initialBalance,
  reservedMargin: 0,
  totalPnl: 0,
  totalPnlPercent: 0,
  totalFees: 0,
  positions: [],
  history: [],
  strategies: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

/**
 * Open a new paper position
 */
export const openPosition = (portfolio, trade, config = {}) => {
  const { allocation = 500, leverage = 1, takerFee = 0.001 } = config

  const margin = Math.min(allocation, portfolio.balance - portfolio.reservedMargin)
  if (margin <= 0) return { portfolio, error: 'Insufficient balance' }

  const entryFee = margin * leverage * takerFee
  const position = {
    id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    tradeId: trade.id,
    asset: trade.asset,
    strategy: trade.strategy,
    entry: parseFloat(trade.entry),
    takeProfit: parseFloat(trade.takeProfit),
    stopLoss: parseFloat(trade.stopLoss),
    margin,
    leverage,
    notional: margin * leverage,
    entryFee,
    exitFee: 0,
    currentPrice: parseFloat(trade.entry),
    unrealizedPnl: -entryFee,
    unrealizedPnlPercent: -(takerFee * 100),
    status: 'open',
    promptId: trade.promptId || null,
    promptName: trade.promptName || 'Manual',
    openedAt: new Date().toISOString(),
    closedAt: null,
    closeReason: null
  }

  return {
    portfolio: {
      ...portfolio,
      balance: portfolio.balance - entryFee,
      reservedMargin: portfolio.reservedMargin + margin,
      positions: [...portfolio.positions, position],
      totalFees: portfolio.totalFees + entryFee,
      updatedAt: new Date().toISOString()
    },
    position,
    error: null
  }
}

/**
 * Update all open positions with current prices
 */
export const updatePositions = (portfolio, prices, config = {}) => {
  const { takerFee = 0.001 } = config
  let totalUnrealized = 0

  const updatedPositions = portfolio.positions.map(pos => {
    if (pos.status !== 'open') return pos

    const currentPrice = prices[pos.asset]
    if (!currentPrice) return pos

    let pnlPercent
    if (pos.strategy === 'LONG') {
      pnlPercent = ((currentPrice - pos.entry) / pos.entry) * 100
    } else {
      pnlPercent = ((pos.entry - currentPrice) / pos.entry) * 100
    }

    const unrealizedPnl = (pnlPercent / 100) * pos.notional - pos.entryFee - (pos.notional * takerFee)
    totalUnrealized += unrealizedPnl

    // Check TP/SL
    let status = 'open'
    let closeReason = null

    if (pos.strategy === 'LONG') {
      if (currentPrice >= pos.takeProfit) { status = 'closed'; closeReason = 'TP_HIT' }
      if (currentPrice <= pos.stopLoss) { status = 'closed'; closeReason = 'SL_HIT' }
    } else {
      if (currentPrice <= pos.takeProfit) { status = 'closed'; closeReason = 'TP_HIT' }
      if (currentPrice >= pos.stopLoss) { status = 'closed'; closeReason = 'SL_HIT' }
    }

    return {
      ...pos,
      currentPrice,
      unrealizedPnl,
      unrealizedPnlPercent: pnlPercent * pos.leverage,
      status,
      closeReason,
      closedAt: status === 'closed' ? new Date().toISOString() : null
    }
  })

  // Process newly closed positions
  const newlyClosed = updatedPositions.filter(p => p.status === 'closed' && !portfolio.positions.find(op => op.id === p.id && op.status === 'closed'))
  let balanceChange = 0
  let marginRelease = 0

  const historyEntries = []

  for (const pos of newlyClosed) {
    const exitFee = pos.notional * takerFee
    let realizedPnl

    if (pos.closeReason === 'TP_HIT') {
      if (pos.strategy === 'LONG') {
        realizedPnl = ((pos.takeProfit - pos.entry) / pos.entry) * pos.notional
      } else {
        realizedPnl = ((pos.entry - pos.takeProfit) / pos.entry) * pos.notional
      }
    } else {
      if (pos.strategy === 'LONG') {
        realizedPnl = ((pos.stopLoss - pos.entry) / pos.entry) * pos.notional
      } else {
        realizedPnl = ((pos.entry - pos.stopLoss) / pos.entry) * pos.notional
      }
    }

    const netPnl = realizedPnl - pos.entryFee - exitFee
    balanceChange += pos.margin + netPnl
    marginRelease += pos.margin

    historyEntries.push({
      ...pos,
      exitFee,
      realizedPnl: netPnl,
      realizedPnlPercent: (netPnl / pos.margin) * 100
    })
  }

  // Update portfolio
  const newBalance = portfolio.balance + balanceChange
  const newReserved = portfolio.reservedMargin - marginRelease
  const allHistory = [...portfolio.history, ...historyEntries]
  const totalRealizedPnl = allHistory.reduce((s, h) => s + (h.realizedPnl || 0), 0)
  const totalFees = portfolio.totalFees + historyEntries.reduce((s, h) => s + (h.exitFee || 0), 0)

  // Update strategy stats
  const strategies = { ...portfolio.strategies }
  for (const entry of historyEntries) {
    const key = entry.promptName || 'Manual'
    if (!strategies[key]) {
      strategies[key] = { trades: 0, wins: 0, losses: 0, pnl: 0 }
    }
    strategies[key].trades++
    if (entry.realizedPnl > 0) strategies[key].wins++
    else strategies[key].losses++
    strategies[key].pnl += entry.realizedPnl
  }

  return {
    ...portfolio,
    balance: newBalance,
    reservedMargin: Math.max(0, newReserved),
    totalPnl: totalRealizedPnl,
    totalPnlPercent: (totalRealizedPnl / portfolio.initialBalance) * 100,
    totalFees,
    positions: updatedPositions,
    history: allHistory,
    strategies,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Close a position manually
 */
export const closePosition = (portfolio, positionId, currentPrice, config = {}) => {
  const { takerFee = 0.001 } = config

  const pos = portfolio.positions.find(p => p.id === positionId)
  if (!pos || pos.status !== 'open') return portfolio

  const exitFee = pos.notional * takerFee
  let realizedPnl
  if (pos.strategy === 'LONG') {
    realizedPnl = ((currentPrice - pos.entry) / pos.entry) * pos.notional
  } else {
    realizedPnl = ((pos.entry - currentPrice) / pos.entry) * pos.notional
  }

  const netPnl = realizedPnl - pos.entryFee - exitFee
  const closedPos = {
    ...pos,
    currentPrice,
    status: 'closed',
    closeReason: 'MANUAL',
    closedAt: new Date().toISOString(),
    exitFee,
    realizedPnl: netPnl,
    realizedPnlPercent: (netPnl / pos.margin) * 100
  }

  const newHistory = [...portfolio.history, closedPos]
  const totalRealizedPnl = newHistory.reduce((s, h) => s + (h.realizedPnl || 0), 0)

  return {
    ...portfolio,
    balance: portfolio.balance + pos.margin + netPnl,
    reservedMargin: Math.max(0, portfolio.reservedMargin - pos.margin),
    totalPnl: totalRealizedPnl,
    totalPnlPercent: (totalRealizedPnl / portfolio.initialBalance) * 100,
    totalFees: portfolio.totalFees + exitFee,
    positions: portfolio.positions.map(p => p.id === positionId ? closedPos : p),
    history: newHistory,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Get portfolio summary stats
 */
export const getPortfolioStats = (portfolio) => {
  const openPositions = portfolio.positions.filter(p => p.status === 'open')
  const totalUnrealized = openPositions.reduce((s, p) => s + (p.unrealizedPnl || 0), 0)
  const totalMarginUsed = openPositions.reduce((s, p) => s + p.margin, 0)
  const equity = portfolio.balance + totalUnrealized + totalMarginUsed

  const historyWins = portfolio.history.filter(h => (h.realizedPnl || 0) > 0).length
  const historyTotal = portfolio.history.length
  const winRate = historyTotal > 0 ? (historyWins / historyTotal) * 100 : 0

  const grossProfit = portfolio.history.filter(h => (h.realizedPnl || 0) > 0).reduce((s, h) => s + h.realizedPnl, 0)
  const grossLoss = Math.abs(portfolio.history.filter(h => (h.realizedPnl || 0) < 0).reduce((s, h) => s + h.realizedPnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0)

  return {
    equity,
    balance: portfolio.balance,
    unrealizedPnl: totalUnrealized,
    unrealizedPnlPercent: portfolio.initialBalance > 0 ? (totalUnrealized / portfolio.initialBalance) * 100 : 0,
    openPositions: openPositions.length,
    totalMarginUsed,
    availableMargin: portfolio.balance - portfolio.reservedMargin,
    totalTrades: historyTotal,
    winRate,
    profitFactor,
    totalPnl: portfolio.totalPnl,
    totalPnlPercent: portfolio.totalPnlPercent,
    allTimePnl: portfolio.totalPnl + totalUnrealized,
    allTimePnlPercent: portfolio.initialBalance > 0
      ? ((portfolio.totalPnl + totalUnrealized) / portfolio.initialBalance) * 100
      : 0
  }
}
