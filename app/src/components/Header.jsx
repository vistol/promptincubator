import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import useStore from '../store/useStore'
import SyncStatus from './SyncStatus'

export default function Header({ title, subtitle, rightAction }) {
  const priceStatus = useStore((state) => state.priceStatus) || {}
  const refreshPrices = useStore((state) => state.refreshPrices)
  const { isFetching = false, lastUpdated = null, source = null, fallbackUsed = false, error = null } = priceStatus

  const handleRefresh = async () => {
    if (!isFetching) {
      await refreshPrices()
    }
  }

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never'
    const date = new Date(lastUpdated)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-30 bg-quant-bg/80 backdrop-blur-lg border-b border-quant-border px-4 py-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gradient-text">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Price Sync Button */}
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              isFetching
                ? 'bg-accent-cyan/10 text-accent-cyan'
                : error
                ? 'bg-accent-red/10 text-accent-red hover:bg-accent-red/20'
                : 'bg-quant-surface text-gray-400 hover:text-accent-cyan hover:bg-quant-card'
            }`}
            title={error ? `Error: ${error}` : `Last update: ${formatLastUpdated()}${source ? ` (${source})` : ''}${fallbackUsed ? ' [fallback]' : ''}`}
          >
            <RefreshCw
              size={14}
              className={isFetching ? 'animate-spin' : ''}
            />
            <span className="text-xs font-medium">
              {isFetching ? 'Syncing...' : formatLastUpdated()}
            </span>
            {source && !isFetching && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                fallbackUsed ? 'bg-accent-yellow/20 text-accent-yellow' : 'bg-accent-green/20 text-accent-green'
              }`}>
                {source === 'binance' ? 'BN' : 'TV'}
              </span>
            )}
          </button>

          {/* Cloud Sync Status */}
          <SyncStatus />

          {rightAction && rightAction}
        </div>
      </div>
    </motion.header>
  )
}
