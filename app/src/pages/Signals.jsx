import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Info, Clock } from 'lucide-react'
import useStore from '../store/useStore'
import Header from '../components/Header'

export default function Signals() {
  const signals = useStore((state) => state.signals) || []
  const openSignalDetail = useStore((state) => state.openSignalDetail)

  const sortedSignals = [...signals].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return 'Just now'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Header
        title="Signals"
        subtitle={`${signals.length} trading signals`}
      />

      {/* Signals List */}
      <div className="px-4 pb-4">
        {sortedSignals.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-quant-surface flex items-center justify-center">
              <TrendingUp size={32} className="text-gray-500" />
            </div>
            <p className="text-gray-400 mb-2">No signals yet</p>
            <p className="text-sm text-gray-500">
              Signals will appear here when prompts generate trades
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSignals.map((signal, index) => {
              const isLong = signal.strategy === 'LONG'
              const isClosed = signal.status === 'closed'

              return (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`bg-quant-card border rounded-2xl overflow-hidden ${
                    isClosed
                      ? signal.result === 'win'
                        ? 'border-accent-green/30'
                        : 'border-accent-red/30'
                      : 'border-quant-border'
                  }`}
                >
                  {/* Main Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      {/* Left: Asset & Strategy */}
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                          isLong ? 'bg-accent-green/20' : 'bg-accent-red/20'
                        }`}>
                          {isLong ? (
                            <TrendingUp size={20} className="text-accent-green" />
                          ) : (
                            <TrendingDown size={20} className="text-accent-red" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isLong ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                            }`}>
                              {signal.strategy}
                            </span>
                            <span className="font-semibold text-white">{signal.asset}</span>
                          </div>
                          <span className="text-xs text-gray-500">{signal.promptName}</span>
                        </div>
                      </div>

                      {/* Right: IPE & Info */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-xs text-gray-500 block">IPE</span>
                          <span className={`font-mono font-bold ${
                            signal.ipe >= 80 ? 'text-accent-green' : signal.ipe >= 70 ? 'text-accent-yellow' : 'text-accent-orange'
                          }`}>
                            {signal.ipe}%
                          </span>
                        </div>
                        <button
                          onClick={() => openSignalDetail(signal)}
                          className="p-2 rounded-lg hover:bg-quant-surface transition-colors"
                        >
                          <Info size={18} className="text-accent-cyan" />
                        </button>
                      </div>
                    </div>

                    {/* Price Levels */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="bg-quant-surface rounded-lg p-2.5">
                        <span className="text-xs text-gray-500 block">Entry</span>
                        <span className="font-mono text-sm text-white">
                          ${Number(signal.entry).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-quant-surface rounded-lg p-2.5">
                        <span className="text-xs text-accent-green block">Take Profit</span>
                        <span className="font-mono text-sm text-accent-green">
                          ${Number(signal.takeProfit).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-quant-surface rounded-lg p-2.5">
                        <span className="text-xs text-accent-red block">Stop Loss</span>
                        <span className="font-mono text-sm text-accent-red">
                          ${Number(signal.stopLoss).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className={`px-4 py-2.5 border-t flex items-center justify-between ${
                    isClosed
                      ? signal.result === 'win'
                        ? 'bg-accent-green/10 border-accent-green/20'
                        : 'bg-accent-red/10 border-accent-red/20'
                      : 'bg-quant-surface/50 border-quant-border'
                  }`}>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock size={12} />
                      {formatTime(signal.createdAt)}
                    </div>

                    {isClosed ? (
                      <div className={`font-mono font-bold ${
                        signal.result === 'win' ? 'text-accent-green' : 'text-accent-red'
                      }`}>
                        {signal.pnl >= 0 ? '+' : ''}{signal.pnl.toFixed(2)} USD
                      </div>
                    ) : (
                      <span className="text-xs text-accent-cyan flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
