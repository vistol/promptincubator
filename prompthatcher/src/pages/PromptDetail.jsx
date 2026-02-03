import { motion } from 'framer-motion'
import {
  ArrowLeft, Play, Copy, Edit3, TrendingUp, TrendingDown,
  Target, AlertTriangle, Award, BarChart3, Clock
} from 'lucide-react'
import useStore from '../store/useStore'
import EggIcon from '../components/EggIcon'

export default function PromptDetail() {
  const {
    prompts,
    signals,
    selectedPromptId,
    setSelectedPromptId,
    addSignal,
    setActiveTab
  } = useStore()

  const prompt = prompts.find(p => p.id === selectedPromptId)

  if (!prompt) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Prompt not found</p>
      </div>
    )
  }

  const promptSignals = signals.filter(s => s.promptId === selectedPromptId)
  const winningTrades = promptSignals.filter(s => s.status === 'closed' && s.result === 'win')
  const losingTrades = promptSignals.filter(s => s.status === 'closed' && s.result === 'loss')

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt.content)
  }

  const handleEditPrompt = () => {
    setSelectedPromptId(null)
    setActiveTab('settings')
  }

  const handleContinueTesting = () => {
    addSignal(prompt.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="min-h-screen"
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-quant-bg/80 backdrop-blur-lg border-b border-quant-border px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedPromptId(null)}
            className="p-2 rounded-xl bg-quant-surface hover:bg-quant-border transition-colors"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{prompt.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                prompt.mode === 'auto'
                  ? 'bg-accent-cyan/20 text-accent-cyan'
                  : 'bg-accent-orange/20 text-accent-orange'
              }`}>
                {prompt.mode.toUpperCase()}
              </span>
              <span className="text-xs text-gray-500 capitalize">{prompt.executionTime}</span>
            </div>
          </div>
          <EggIcon size={48} status="hatched" winRate={prompt.winRate} />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-quant-card border border-quant-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-accent-cyan" />
              <span className="text-xs text-gray-400">Win Rate</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono ${
                prompt.winRate >= 50 ? 'text-accent-green' : 'text-accent-red'
              }`}>
                {prompt.winRate}
              </span>
              <span className="text-gray-500">%</span>
            </div>
            <div className="mt-2 h-1.5 bg-quant-surface rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  prompt.winRate >= 50 ? 'bg-accent-green' : 'bg-accent-red'
                }`}
                style={{ width: `${prompt.winRate}%` }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-quant-card border border-quant-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-accent-cyan" />
              <span className="text-xs text-gray-400">Profit Factor</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono ${
                prompt.profitFactor >= 1 ? 'text-accent-green' : 'text-accent-red'
              }`}>
                {prompt.profitFactor.toFixed(2)}
              </span>
            </div>
            <span className="text-xs text-gray-500 mt-1 block">
              {prompt.profitFactor >= 2 ? 'Excellent' : prompt.profitFactor >= 1.5 ? 'Good' : prompt.profitFactor >= 1 ? 'Acceptable' : 'Poor'}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-quant-card border border-quant-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-accent-red" />
              <span className="text-xs text-gray-400">Max Drawdown</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-accent-red">
                {prompt.maxDrawdown}
              </span>
              <span className="text-gray-500">%</span>
            </div>
            <span className="text-xs text-gray-500 mt-1 block">
              {prompt.maxDrawdown <= 10 ? 'Low risk' : prompt.maxDrawdown <= 20 ? 'Moderate' : 'High risk'}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`bg-quant-card border rounded-xl p-4 ${
              prompt.totalPnl >= 0 ? 'stat-glow-positive' : 'stat-glow-negative'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {prompt.totalPnl >= 0 ? (
                <TrendingUp size={16} className="text-accent-green" />
              ) : (
                <TrendingDown size={16} className="text-accent-red" />
              )}
              <span className="text-xs text-gray-400">Total PnL</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono ${
                prompt.totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'
              }`}>
                {prompt.totalPnl >= 0 ? '+' : ''}{prompt.totalPnl.toFixed(0)}
              </span>
              <span className="text-gray-500 text-sm">USD</span>
            </div>
          </motion.div>
        </div>

        {/* Prompt Content */}
        <div className="bg-quant-card border border-quant-border rounded-xl p-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Prompt Content</h3>
          <p className="text-sm text-gray-300 font-mono leading-relaxed">
            {prompt.content}
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-quant-card border border-quant-border rounded-xl p-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Configuration</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-quant-surface rounded-lg p-3">
              <span className="text-xs text-gray-500 block">Capital</span>
              <span className="text-sm font-mono text-white">${prompt.capital.toLocaleString()}</span>
            </div>
            <div className="bg-quant-surface rounded-lg p-3">
              <span className="text-xs text-gray-500 block">Leverage</span>
              <span className="text-sm font-mono text-white">{prompt.leverage}x</span>
            </div>
            <div className="bg-quant-surface rounded-lg p-3">
              <span className="text-xs text-gray-500 block">AI Model</span>
              <span className="text-sm font-mono text-white capitalize">{prompt.aiModel}</span>
            </div>
            <div className="bg-quant-surface rounded-lg p-3">
              <span className="text-xs text-gray-500 block">Min IPE</span>
              <span className="text-sm font-mono text-white">{prompt.minIpe}%</span>
            </div>
          </div>
        </div>

        {/* Trade History */}
        <div className="bg-quant-card border border-quant-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-quant-border">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider">Trade History</h3>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-gray-400">
                <span className="text-white font-mono">{prompt.trades}</span> total
              </span>
              <span className="text-sm text-accent-green">
                <span className="font-mono">{winningTrades.length}</span> wins
              </span>
              <span className="text-sm text-accent-red">
                <span className="font-mono">{losingTrades.length}</span> losses
              </span>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="divide-y divide-quant-border">
            {promptSignals.slice(0, 5).map((signal) => {
              const isLong = signal.strategy === 'LONG'
              const isClosed = signal.status === 'closed'

              return (
                <div key={signal.id} className="p-3 flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${
                    isLong ? 'bg-accent-green/20' : 'bg-accent-red/20'
                  }`}>
                    {isLong ? (
                      <TrendingUp size={14} className="text-accent-green" />
                    ) : (
                      <TrendingDown size={14} className="text-accent-red" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{signal.asset}</span>
                      <span className={`text-xs ${
                        isLong ? 'text-accent-green' : 'text-accent-red'
                      }`}>
                        {signal.strategy}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      Entry: ${Number(signal.entry).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    {isClosed ? (
                      <span className={`text-sm font-mono font-bold ${
                        signal.result === 'win' ? 'text-accent-green' : 'text-accent-red'
                      }`}>
                        {signal.pnl >= 0 ? '+' : ''}{signal.pnl.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-accent-cyan flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {promptSignals.length === 0 && (
              <div className="p-8 text-center">
                <Clock size={24} className="mx-auto text-gray-500 mb-2" />
                <p className="text-sm text-gray-500">No trades yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3 pt-2 pb-8">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleContinueTesting}
            className="flex flex-col items-center gap-2 bg-quant-card border border-quant-border rounded-xl p-4 hover:border-accent-cyan/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-accent-cyan/20">
              <Play size={20} className="text-accent-cyan" />
            </div>
            <span className="text-xs text-gray-400">Continue</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCopyPrompt}
            className="flex flex-col items-center gap-2 bg-quant-card border border-quant-border rounded-xl p-4 hover:border-accent-cyan/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-accent-orange/20">
              <Copy size={20} className="text-accent-orange" />
            </div>
            <span className="text-xs text-gray-400">Copy</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleEditPrompt}
            className="flex flex-col items-center gap-2 bg-quant-card border border-quant-border rounded-xl p-4 hover:border-accent-cyan/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-accent-green/20">
              <Edit3 size={20} className="text-accent-green" />
            </div>
            <span className="text-xs text-gray-400">Edit</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
