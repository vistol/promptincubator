import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, TrendingUp, TrendingDown, Loader2, AlertCircle, CheckSquare, Square, Shield, ChevronDown, ChevronUp, Lightbulb, Target, HelpCircle, CheckCircle2, XCircle } from 'lucide-react'
import useStore from '../store/useStore'
import EggIcon from './EggIcon'

export default function TradeSelectionModal({ prompt, onClose, onComplete }) {
  const {
    pendingTrades,
    isGeneratingTrades,
    generationError,
    toggleTradeSelection,
    selectAllTrades,
    createEgg,
    clearPendingTrades
  } = useStore()

  const selectedCount = pendingTrades.filter(t => t.selected).length
  const allSelected = pendingTrades.length > 0 && selectedCount === pendingTrades.length

  // Track which trades have expanded details
  const [expandedTrades, setExpandedTrades] = useState({})

  const toggleExpanded = (tradeId) => {
    setExpandedTrades(prev => ({
      ...prev,
      [tradeId]: !prev[tradeId]
    }))
  }

  const handleIncubate = () => {
    if (selectedCount === 0) return

    const egg = createEgg(prompt)
    if (egg) {
      onComplete(egg)
    }
  }

  const handleCancel = () => {
    clearPendingTrades()
    onClose()
  }

  if (isGeneratingTrades) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-quant-card rounded-2xl p-8 max-w-sm mx-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-24 h-24 mx-auto mb-6">
            <EggIcon size={96} status="incubating" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={32} className="text-accent-cyan animate-spin" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Generating Trades</h3>
          <p className="text-sm text-gray-400 mb-6">
            Fetching real-time prices from Binance and generating trading opportunities...
          </p>
          <button
            onClick={handleCancel}
            className="w-full py-3 rounded-xl bg-quant-surface text-gray-400 hover:text-white hover:bg-quant-border transition-colors active:scale-95"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    )
  }

  if (generationError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-quant-card rounded-2xl p-8 max-w-sm mx-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-red/20 flex items-center justify-center">
            <AlertCircle size={32} className="text-accent-red" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Generation Failed</h3>
          <p className="text-sm text-gray-400 mb-6">{generationError}</p>
          <button
            onClick={handleCancel}
            className="w-full py-3 rounded-xl bg-quant-surface text-white"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-quant-card rounded-t-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-quant-card border-b border-quant-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Select Trades</h2>
              <p className="text-xs text-gray-500">{prompt.name}</p>
            </div>
            <button
              onClick={handleCancel}
              className="p-3 -mr-1 rounded-full hover:bg-quant-surface transition-colors active:scale-90"
            >
              <X size={22} className="text-gray-400" />
            </button>
          </div>

          {/* Select All */}
          <button
            onClick={selectAllTrades}
            className="mt-3 flex items-center gap-2 text-sm text-accent-cyan"
          >
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            Select All ({pendingTrades.length} trades)
          </button>
        </div>

        {/* Trades List */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-3">
          {pendingTrades.map((trade, index) => {
            const isLong = trade.strategy === 'LONG'
            const isExpanded = expandedTrades[trade.id]

            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-quant-surface border-2 rounded-xl transition-all ${
                  trade.selected
                    ? 'border-accent-cyan bg-accent-cyan/5'
                    : 'border-quant-border hover:border-gray-600'
                }`}
              >
                {/* Main Trade Card - Clickable for selection */}
                <button
                  onClick={() => toggleTradeSelection(trade.id)}
                  className="w-full text-left p-4"
                >
                  {/* Trade Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isLong ? 'bg-accent-green/20' : 'bg-accent-red/20'
                      }`}>
                        {isLong ? (
                          <TrendingUp size={18} className="text-accent-green" />
                        ) : (
                          <TrendingDown size={18} className="text-accent-red" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isLong ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                          }`}>
                            {trade.strategy}
                          </span>
                          <span className="font-semibold text-white">{trade.asset}</span>
                        </div>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      trade.selected
                        ? 'border-accent-cyan bg-accent-cyan'
                        : 'border-gray-500'
                    }`}>
                      {trade.selected && <Check size={14} className="text-quant-bg" />}
                    </div>
                  </div>

                  {/* LEVEL 1: One-line Summary */}
                  <div className="flex items-start gap-2 mb-3 p-2 bg-quant-bg/50 rounded-lg">
                    <Lightbulb size={14} className="text-accent-yellow shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {trade.summary || trade.explanation || 'AI-generated trade based on your strategy'}
                    </p>
                  </div>

                  {/* Price Levels */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="bg-quant-bg/50 rounded-lg p-2">
                      <span className="text-xs text-accent-cyan block">Market</span>
                      <span className="font-mono text-sm text-accent-cyan">${trade.currentPrice}</span>
                    </div>
                    <div className="bg-quant-bg/50 rounded-lg p-2">
                      <span className="text-xs text-gray-500 block">Entry</span>
                      <span className="font-mono text-sm text-white">${trade.entry}</span>
                    </div>
                    <div className="bg-quant-bg/50 rounded-lg p-2">
                      <span className="text-xs text-accent-green block">TP</span>
                      <span className="font-mono text-sm text-accent-green">${trade.takeProfit}</span>
                    </div>
                    <div className="bg-quant-bg/50 rounded-lg p-2">
                      <span className="text-xs text-accent-red block">SL</span>
                      <span className="font-mono text-sm text-accent-red">${trade.stopLoss}</span>
                    </div>
                  </div>

                  {/* R:R and IPE */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Shield size={12} className="text-accent-cyan" />
                        <span className={`font-mono text-sm font-bold ${
                          parseFloat(trade.riskRewardRatio) >= 2 ? 'text-accent-green' : 'text-accent-yellow'
                        }`}>
                          1:{trade.riskRewardRatio}
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-sm ${
                        trade.ipe >= 80 ? 'text-accent-green' : trade.ipe >= 70 ? 'text-accent-yellow' : 'text-accent-orange'
                      }`}>
                        IPE {trade.ipe}%
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expand/Collapse Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpanded(trade.id)
                  }}
                  className="w-full px-4 py-2 border-t border-quant-border flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-accent-cyan hover:bg-quant-bg/30 transition-colors"
                >
                  <HelpCircle size={12} />
                  {isExpanded ? 'Hide details' : 'Why this trade?'}
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* LEVEL 2: Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        {/* Reasoning Breakdown */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <Target size={10} /> Decision Breakdown
                          </h4>

                          {/* Why this asset */}
                          <div className="p-2 bg-quant-bg/50 rounded-lg">
                            <span className="text-[10px] text-accent-cyan uppercase tracking-wider block mb-1">Why {trade.asset}?</span>
                            <p className="text-xs text-gray-300">{trade.reasoning?.whyAsset || 'Selected based on strategy criteria'}</p>
                          </div>

                          {/* Why this direction */}
                          <div className="p-2 bg-quant-bg/50 rounded-lg">
                            <span className="text-[10px] text-accent-cyan uppercase tracking-wider block mb-1">Why {trade.strategy}?</span>
                            <p className="text-xs text-gray-300">{trade.reasoning?.whyDirection || `${trade.strategy} signal from analysis`}</p>
                          </div>

                          {/* Why these levels */}
                          <div className="p-2 bg-quant-bg/50 rounded-lg">
                            <span className="text-[10px] text-accent-cyan uppercase tracking-wider block mb-1">Why Entry ${trade.entry}?</span>
                            <p className="text-xs text-gray-300">{trade.reasoning?.whyEntry || 'Based on current price analysis'}</p>
                          </div>

                          <div className="p-2 bg-quant-bg/50 rounded-lg">
                            <span className="text-[10px] text-accent-cyan uppercase tracking-wider block mb-1">Why TP/SL Levels?</span>
                            <p className="text-xs text-gray-300">{trade.reasoning?.whyLevels || `Calculated for ${trade.riskRewardRatio}:1 R:R`}</p>
                          </div>
                        </div>

                        {/* Criteria Matched */}
                        {trade.criteriaMatched && trade.criteriaMatched.length > 0 && (
                          <div>
                            <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Strategy Criteria Check
                            </h4>
                            <div className="space-y-1">
                              {trade.criteriaMatched.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-quant-bg/30 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    {c.passed ? (
                                      <CheckCircle2 size={12} className="text-accent-green" />
                                    ) : (
                                      <XCircle size={12} className="text-accent-red" />
                                    )}
                                    <span className="text-xs text-gray-300">{c.criterion}</span>
                                  </div>
                                  <span className={`text-xs font-mono ${c.passed ? 'text-accent-green' : 'text-accent-red'}`}>
                                    {c.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Confidence Factors */}
                        {trade.confidenceFactors && trade.confidenceFactors.length > 0 && (
                          <div>
                            <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Shield size={10} /> IPE {trade.ipe}% Breakdown
                            </h4>
                            <div className="space-y-2">
                              {trade.confidenceFactors.map((f, i) => (
                                <div key={i} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">{f.factor}</span>
                                    <span className="text-gray-300 font-mono">
                                      {f.weight}% × {f.score} = <span className="text-accent-cyan">+{(f.contribution || (f.weight * f.score / 100)).toFixed(1)}</span>
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-quant-bg rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full transition-all"
                                      style={{ width: `${f.score}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                              <div className="pt-2 border-t border-quant-border flex items-center justify-between">
                                <span className="text-xs text-gray-400">Total IPE Score</span>
                                <span className="font-mono font-bold text-accent-cyan">{trade.ipe}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-quant-border bg-quant-card space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {selectedCount} of {pendingTrades.length} trades selected
            </span>
            {selectedCount > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-accent-green flex items-center gap-1">
                  <Shield size={12} />
                  R:R 1:{(
                    pendingTrades
                      .filter(t => t.selected)
                      .reduce((sum, t) => sum + parseFloat(t.riskRewardRatio || 0), 0) / selectedCount
                  ).toFixed(1)}
                </span>
                <span className="text-accent-cyan">
                  IPE: {Math.round(
                    pendingTrades
                      .filter(t => t.selected)
                      .reduce((sum, t) => sum + t.ipe, 0) / selectedCount
                  )}%
                </span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <motion.button
            onClick={handleIncubate}
            disabled={selectedCount === 0}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <EggIcon size={24} status="incubating" />
            Start Incubation ({selectedCount} trades)
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
