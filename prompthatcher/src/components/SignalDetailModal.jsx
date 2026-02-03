import { motion } from 'framer-motion'
import { X, TrendingUp, TrendingDown, Target, Shield, Info, Lightbulb, FileText } from 'lucide-react'
import useStore from '../store/useStore'

export default function SignalDetailModal() {
  const selectedSignal = useStore((state) => state.selectedSignal)
  const closeSignalDetail = useStore((state) => state.closeSignalDetail)

  if (!selectedSignal) return null

  const isLong = selectedSignal.strategy === 'LONG'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeSignalDetail}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-quant-card rounded-t-3xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-quant-card border-b border-quant-border px-4 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isLong ? 'bg-accent-green/20' : 'bg-accent-red/20'}`}>
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
                    {selectedSignal.strategy}
                  </span>
                  <span className="font-bold text-white">{selectedSignal.asset}</span>
                </div>
                <span className="text-xs text-gray-500">{selectedSignal.promptName}</span>
              </div>
            </div>
            <button
              onClick={closeSignalDetail}
              className="p-3 -mr-1 rounded-full hover:bg-quant-surface transition-colors active:scale-90"
            >
              <X size={22} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto hide-scrollbar p-4 pb-8 space-y-4">
          {/* Price Levels */}
          <div className="bg-quant-surface rounded-xl p-4 border border-quant-border">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Target size={14} />
              Price Levels
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Entry</span>
                <span className="font-mono text-white">${Number(selectedSignal.entry).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-accent-green flex items-center gap-2">
                  <TrendingUp size={14} />
                  Take Profit
                </span>
                <span className="font-mono text-accent-green">${Number(selectedSignal.takeProfit).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-accent-red flex items-center gap-2">
                  <Shield size={14} />
                  Stop Loss
                </span>
                <span className="font-mono text-accent-red">${Number(selectedSignal.stopLoss).toLocaleString()}</span>
              </div>
            </div>

            {/* Visual price bar */}
            <div className="mt-4 relative h-2 bg-quant-border rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-accent-red/50" />
              <div className="absolute inset-y-0 left-1/3 w-1/3 bg-accent-cyan/50" />
              <div className="absolute inset-y-0 right-0 w-1/3 bg-accent-green/50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-quant-bg" />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>SL</span>
              <span>Entry</span>
              <span>TP</span>
            </div>
          </div>

          {/* IPE Score */}
          <div className="bg-quant-surface rounded-xl p-4 border border-quant-border">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Success Probability (IPE)</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="3"
                    strokeDasharray={`${selectedSignal.ipe}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-accent-cyan">{selectedSignal.ipe}%</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-400">
                  {selectedSignal.ipe >= 80 ? (
                    <span className="text-accent-green">High probability setup</span>
                  ) : selectedSignal.ipe >= 70 ? (
                    <span className="text-accent-yellow">Moderate probability</span>
                  ) : (
                    <span className="text-accent-orange">Lower probability</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Based on historical patterns and current market conditions
                </div>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-quant-surface rounded-xl p-4 border border-quant-border">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText size={14} />
              Analysis
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              {selectedSignal.explanation}
            </p>
          </div>

          {/* Insights */}
          <div className="bg-quant-surface rounded-xl p-4 border border-quant-border">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lightbulb size={14} />
              Key Insights
            </h3>
            <ul className="space-y-2">
              {selectedSignal.insights.map((insight, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-accent-cyan mt-1">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          {/* Timestamp */}
          <div className="text-center text-xs text-gray-500">
            Signal generated: {new Date(selectedSignal.createdAt).toLocaleString()}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
