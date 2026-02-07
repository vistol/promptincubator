import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical, BarChart3, LineChart, Trophy } from 'lucide-react'
import useStore from '../store/useStore'
import BacktestTab from '../components/lab/BacktestTab'
import PaperTradeTab from '../components/lab/PaperTradeTab'
import BenchmarkTab from '../components/lab/BenchmarkTab'

const tabs = [
  { id: 'backtest', label: 'Backtest', icon: BarChart3 },
  { id: 'paperTrade', label: 'Paper Trade', icon: LineChart },
  { id: 'benchmark', label: 'Benchmark', icon: Trophy },
]

export default function Lab() {
  const labActiveTab = useStore((state) => state.labActiveTab) || 'backtest'
  const setLabActiveTab = useStore((state) => state.setLabActiveTab)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-4 pt-4 pb-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent-orange/10 flex items-center justify-center">
          <FlaskConical size={20} className="text-accent-orange" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Lab</h1>
          <p className="text-[10px] text-gray-500">Backtest, paper trade & benchmark your strategies</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-quant-surface rounded-xl p-1 mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = labActiveTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setLabActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-quant-card text-white shadow'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {labActiveTab === 'backtest' && (
          <motion.div key="backtest" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <BacktestTab />
          </motion.div>
        )}
        {labActiveTab === 'paperTrade' && (
          <motion.div key="paperTrade" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <PaperTradeTab />
          </motion.div>
        )}
        {labActiveTab === 'benchmark' && (
          <motion.div key="benchmark" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <BenchmarkTab />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
