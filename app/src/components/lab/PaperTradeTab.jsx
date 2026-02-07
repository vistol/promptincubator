import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, TrendingUp, TrendingDown, Wallet, DollarSign, Activity,
  ArrowUpRight, ArrowDownRight, ToggleLeft, ToggleRight, RefreshCw, Trash2
} from 'lucide-react'
import useStore from '../../store/useStore'
import {
  createPortfolio, openPosition, updatePositions, closePosition, getPortfolioStats
} from '../../lib/paperTradingEngine'
import { generateTradesFromPrompt } from '../../lib/aiService'
import EquityCurve from './EquityCurve'

export default function PaperTradeTab() {
  const paperPortfolio = useStore((s) => s.paperPortfolio)
  const updatePaperPortfolio = useStore((s) => s.updatePaperPortfolio)
  const prompts = useStore((s) => s.prompts) || []
  const prices = useStore((s) => s.prices) || {}
  const settings = useStore((s) => s.settings)

  const [showInit, setShowInit] = useState(false)
  const [initBalance, setInitBalance] = useState(10000)
  const [showNewTrade, setShowNewTrade] = useState(false)
  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [allocation, setAllocation] = useState(500)
  const [isGenerating, setIsGenerating] = useState(false)
  const [subTab, setSubTab] = useState('positions') // positions | history | strategies
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const labWizardOpen = useStore((s) => s.labWizardOpen)
  const setLabWizardOpen = useStore((s) => s.setLabWizardOpen)

  const activePrompts = prompts.filter(p => p.status === 'active')

  // Listen for FAB trigger
  useEffect(() => {
    if (labWizardOpen) {
      if (paperPortfolio) {
        setShowNewTrade(true)
      } else {
        setShowInit(true)
      }
      setLabWizardOpen(false)
    }
  }, [labWizardOpen])

  // Update positions with live prices
  useEffect(() => {
    if (!paperPortfolio) return

    const priceMap = {}
    for (const [symbol, data] of Object.entries(prices)) {
      priceMap[symbol] = data.price || data
    }

    if (Object.keys(priceMap).length > 0) {
      const updated = updatePositions(paperPortfolio, priceMap)
      // Only update if something changed (avoid infinite loop)
      const hasChanges = JSON.stringify(updated.positions) !== JSON.stringify(paperPortfolio.positions)
      if (hasChanges) {
        updatePaperPortfolio(updated)
      }
    }
  }, [prices]) // Only trigger on price changes

  const stats = paperPortfolio ? getPortfolioStats(paperPortfolio) : null
  const openPositions = paperPortfolio?.positions?.filter(p => p.status === 'open') || []
  const history = paperPortfolio?.history || []

  const initializePortfolio = () => {
    updatePaperPortfolio(createPortfolio(initBalance))
    setShowInit(false)
  }

  const handleGenerateAndTrade = async () => {
    const prompt = prompts.find(p => p.id === selectedPromptId)
    if (!prompt || !paperPortfolio) return

    setIsGenerating(true)
    try {
      const trades = await generateTradesFromPrompt(prompt, settings, 3, () => {})

      let portfolio = { ...paperPortfolio }
      for (const trade of trades) {
        const result = openPosition(portfolio, {
          ...trade,
          promptId: prompt.id,
          promptName: prompt.name
        }, {
          allocation,
          leverage: prompt.leverage || 5,
          takerFee: 0.001
        })

        if (!result.error) {
          portfolio = result.portfolio
        }
      }

      updatePaperPortfolio(portfolio)
      setShowNewTrade(false)
    } catch (err) {
      console.error('Paper trade generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClosePosition = (posId) => {
    if (!paperPortfolio) return
    const pos = paperPortfolio.positions.find(p => p.id === posId)
    if (!pos) return

    const priceData = prices[pos.asset]
    const currentPrice = priceData?.price || priceData || pos.currentPrice

    const updated = closePosition(paperPortfolio, posId, currentPrice)
    updatePaperPortfolio(updated)
  }

  const handleReset = () => {
    updatePaperPortfolio(createPortfolio(paperPortfolio?.initialBalance || 10000))
    setShowConfirmReset(false)
  }

  // No portfolio yet
  if (!paperPortfolio) {
    return (
      <div className="text-center py-12">
        <Wallet size={48} className="text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-400 mb-1">No virtual portfolio</p>
        <p className="text-[10px] text-gray-600 mb-4">Create a paper trading portfolio to start</p>

        {showInit ? (
          <div className="max-w-xs mx-auto space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Initial Balance</label>
              <input
                type="number"
                value={initBalance}
                onChange={(e) => setInitBalance(parseInt(e.target.value) || 1000)}
                className="w-full mt-1 bg-quant-surface border border-quant-border rounded-xl px-3 py-2.5 text-sm text-white font-mono text-center"
              />
            </div>
            <button
              onClick={initializePortfolio}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-sm"
            >
              Create Portfolio
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInit(true)}
            className="px-4 py-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-medium"
          >
            <Plus size={14} className="inline mr-1" />
            Create Portfolio
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Portfolio Summary Card */}
      <div className="bg-quant-card border border-quant-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Virtual Portfolio</span>
          <button
            onClick={() => setShowConfirmReset(true)}
            className="text-[9px] text-gray-600 hover:text-accent-red transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <div className="text-xl font-mono font-bold text-white">
              ${stats?.equity?.toFixed(0) || '0'}
            </div>
            <div className="text-[10px] text-gray-500">Equity</div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-mono font-bold ${(stats?.allTimePnlPercent || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {(stats?.allTimePnlPercent || 0) >= 0 ? '+' : ''}{(stats?.allTimePnlPercent || 0).toFixed(2)}%
            </div>
            <div className="text-[10px] text-gray-500">All-time</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Open', value: stats?.openPositions || 0, color: 'text-accent-cyan' },
            { label: 'Win Rate', value: `${(stats?.winRate || 0).toFixed(0)}%`, color: 'text-white' },
            { label: 'PF', value: (stats?.profitFactor || 0) === Infinity ? '∞' : (stats?.profitFactor || 0).toFixed(2), color: 'text-white' },
            { label: 'Trades', value: stats?.totalTrades || 0, color: 'text-white' },
          ].map((s) => (
            <div key={s.label} className="bg-quant-surface rounded-lg p-1.5 text-center">
              <div className={`text-[10px] font-mono font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[8px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-quant-surface rounded-lg p-0.5">
        {[
          { id: 'positions', label: `Open (${openPositions.length})` },
          { id: 'history', label: `History (${history.length})` },
          { id: 'strategies', label: 'Strategies' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              subTab === tab.id ? 'bg-quant-card text-white shadow' : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Open Positions */}
      {subTab === 'positions' && (
        <div className="space-y-2">
          {openPositions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">No open positions</p>
          ) : (
            openPositions.map((pos) => {
              const isProfitable = (pos.unrealizedPnlPercent || 0) >= 0
              const entry = pos.entry
              const tp = pos.takeProfit
              const sl = pos.stopLoss
              const current = pos.currentPrice || entry

              // Progress towards TP or SL
              let progressPct = 50
              if (pos.strategy === 'LONG') {
                const totalRange = tp - sl
                progressPct = totalRange > 0 ? ((current - sl) / totalRange) * 100 : 50
              } else {
                const totalRange = sl - tp
                progressPct = totalRange > 0 ? ((sl - current) / totalRange) * 100 : 50
              }
              progressPct = Math.max(0, Math.min(100, progressPct))

              return (
                <div key={pos.id} className="bg-quant-card border border-quant-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${pos.strategy === 'LONG' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                        {pos.strategy}
                      </span>
                      <span className="text-sm font-medium text-white">{pos.asset}</span>
                    </div>
                    <span className={`text-sm font-mono font-bold ${isProfitable ? 'text-accent-green' : 'text-accent-red'}`}>
                      {isProfitable ? '+' : ''}{(pos.unrealizedPnlPercent || 0).toFixed(2)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                    <div><span className="text-gray-500">Entry:</span> <span className="text-white font-mono">${entry.toFixed(2)}</span></div>
                    <div><span className="text-gray-500">Now:</span> <span className="text-white font-mono">${current.toFixed(2)}</span></div>
                    <div><span className="text-gray-500">Margin:</span> <span className="text-white font-mono">${pos.margin.toFixed(0)}</span></div>
                  </div>

                  {/* TP/SL progress bar */}
                  <div className="relative h-1.5 bg-quant-surface rounded-full mb-2">
                    <div
                      className={`absolute h-full rounded-full ${isProfitable ? 'bg-accent-green' : 'bg-accent-red'}`}
                      style={{ width: `${progressPct}%` }}
                    />
                    <div className="absolute top-0 left-0 w-full flex justify-between text-[8px] mt-2">
                      <span className="text-accent-red">SL ${sl.toFixed(0)}</span>
                      <span className="text-accent-green">TP ${tp.toFixed(0)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[9px] text-gray-600">via {pos.promptName}</span>
                    <button
                      onClick={() => handleClosePosition(pos.id)}
                      className="px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:text-accent-red hover:bg-accent-red/10 transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )
            })
          )}

          <button
            onClick={() => setShowNewTrade(true)}
            className="w-full p-3 rounded-xl border border-dashed border-quant-border text-gray-400 text-xs hover:border-accent-cyan hover:text-accent-cyan transition-all"
          >
            <Plus size={14} className="inline mr-1" />
            Generate Paper Trade
          </button>
        </div>
      )}

      {/* History */}
      {subTab === 'history' && (
        <div className="space-y-1">
          {history.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">No completed trades yet</p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-quant-surface rounded-lg text-[10px]">
                <div className="flex items-center gap-2">
                  <span className={`px-1 py-0.5 rounded font-bold ${h.strategy === 'LONG' ? 'text-accent-green' : 'text-accent-red'}`}>
                    {h.strategy}
                  </span>
                  <span className="text-gray-300">{h.asset}</span>
                  <span className="text-gray-600">{h.closeReason}</span>
                </div>
                <span className={`font-mono font-bold ${(h.realizedPnl || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {(h.realizedPnl || 0) >= 0 ? '+' : ''}${(h.realizedPnl || 0).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Strategies */}
      {subTab === 'strategies' && (
        <div className="space-y-2">
          {Object.entries(paperPortfolio.strategies || {}).length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">Strategy stats appear after trades close</p>
          ) : (
            Object.entries(paperPortfolio.strategies).map(([name, s]) => (
              <div key={name} className="bg-quant-surface rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white">{name}</span>
                  <span className={`text-xs font-mono font-bold ${s.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] text-gray-500">
                  <span>{s.trades} trades</span>
                  <span>{s.wins}W / {s.losses}L</span>
                  <span>{s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(0) : 0}% win</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* New Paper Trade Modal */}
      <AnimatePresence>
        {showNewTrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !isGenerating && setShowNewTrade(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-quant-card rounded-t-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 flex items-center justify-between border-b border-quant-border">
                <h2 className="text-base font-bold text-white">Paper Trade</h2>
                <button onClick={() => !isGenerating && setShowNewTrade(false)} className="p-2 rounded-full hover:bg-quant-surface">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">Select Prompt</label>
                  <div className="space-y-1.5 mt-1">
                    {activePrompts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPromptId(p.id)}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                          selectedPromptId === p.id
                            ? 'bg-accent-cyan/10 border-accent-cyan/30 text-white'
                            : 'bg-quant-surface border-quant-border text-gray-400'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">Allocation per trade</label>
                  <input
                    type="number"
                    value={allocation}
                    onChange={(e) => setAllocation(parseInt(e.target.value) || 100)}
                    className="w-full mt-1 bg-quant-surface border border-quant-border rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                  <p className="text-[9px] text-gray-600 mt-1">
                    Available: ${(stats?.availableMargin || 0).toFixed(0)}
                  </p>
                </div>

              </div>

              <div className="px-4 pb-6 pt-2 border-t border-quant-border shrink-0 safe-area-bottom">
                <button
                  onClick={handleGenerateAndTrade}
                  disabled={!selectedPromptId || isGenerating}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-sm disabled:opacity-40"
                >
                  {isGenerating ? (
                    <><RefreshCw size={14} className="inline mr-1 animate-spin" /> Generating...</>
                  ) : (
                    'Generate & Open Positions'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation */}
      <AnimatePresence>
        {showConfirmReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmReset(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-72 bg-quant-card border border-quant-border rounded-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-white mb-2">Reset Portfolio?</h3>
              <p className="text-[10px] text-gray-400 mb-4">This will clear all positions, history, and reset balance to ${paperPortfolio?.initialBalance}.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowConfirmReset(false)} className="flex-1 py-2 rounded-xl bg-quant-surface text-xs text-gray-400">Cancel</button>
                <button onClick={handleReset} className="flex-1 py-2 rounded-xl bg-accent-red/20 text-xs text-accent-red font-medium">Reset</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
