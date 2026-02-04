import { motion, AnimatePresence } from 'framer-motion'
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react'
import useStore from '../store/useStore'

export default function SyncStatus() {
  const syncStatus = useStore((state) => state.syncStatus) || {}
  const settings = useStore((state) => state.settings) || {}
  const syncToCloud = useStore((state) => state.syncToCloud)
  const loadFromCloud = useStore((state) => state.loadFromCloud)

  const supabase = settings.supabase || {}
  const isConnected = supabase.connected || false
  const { syncing = false, loading = false, lastSynced = null, error = null } = syncStatus

  const formatLastSynced = () => {
    if (!lastSynced) return 'Never'
    const date = new Date(lastSynced)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  const handleSync = () => {
    if (!syncing && !loading) {
      syncToCloud()
    }
  }

  const handleLoad = () => {
    if (!syncing && !loading) {
      loadFromCloud()
    }
  }

  if (!supabase.url || !supabase.anonKey) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        {syncing || loading ? (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-accent-cyan"
          >
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-xs">{loading ? 'Loading...' : 'Syncing...'}</span>
          </motion.div>
        ) : error ? (
          <motion.button
            key="error"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleSync}
            className="flex items-center gap-1.5 text-accent-red hover:text-accent-red/80 transition-colors"
            title={error}
          >
            <AlertCircle size={14} />
            <span className="text-xs">Sync failed</span>
          </motion.button>
        ) : isConnected ? (
          <motion.button
            key="connected"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleSync}
            className="flex items-center gap-1.5 text-accent-green hover:text-accent-green/80 transition-colors"
            title={`Last synced: ${formatLastSynced()}`}
          >
            <Cloud size={14} />
            <span className="text-xs hidden sm:inline">{formatLastSynced()}</span>
          </motion.button>
        ) : (
          <motion.button
            key="disconnected"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleSync}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-400 transition-colors"
          >
            <CloudOff size={14} />
            <span className="text-xs">Offline</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
