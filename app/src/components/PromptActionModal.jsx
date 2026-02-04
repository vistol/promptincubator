import { motion } from 'framer-motion'
import { X, PenTool, Play, HeartPulse } from 'lucide-react'
import useStore from '../store/useStore'

const actions = [
  {
    id: 'edit',
    label: 'Edit / Add Prompt',
    description: 'Create a new strategy or edit existing ones',
    icon: PenTool,
    color: 'accent-cyan',
    bgColor: 'bg-accent-cyan/10',
    borderColor: 'border-accent-cyan/30',
  },
  {
    id: 'execute',
    label: 'Execute Prompt',
    description: 'Run a strategy and generate trades',
    icon: Play,
    color: 'accent-green',
    bgColor: 'bg-accent-green/10',
    borderColor: 'border-accent-green/30',
  },
  {
    id: 'healthcheck',
    label: 'Create Health Check',
    description: 'Set up batch preset monitoring',
    icon: HeartPulse,
    color: 'accent-purple',
    bgColor: 'bg-accent-purple/10',
    borderColor: 'border-accent-purple/30',
  },
]

export default function PromptActionModal() {
  const setPromptActionModalOpen = useStore((state) => state.setPromptActionModalOpen)
  const setNewPromptModalOpen = useStore((state) => state.setNewPromptModalOpen)
  const setActiveTab = useStore((state) => state.setActiveTab)

  const handleClose = () => {
    setPromptActionModalOpen(false)
  }

  const handleAction = (actionId) => {
    setPromptActionModalOpen(false)

    switch (actionId) {
      case 'edit':
        // Navigate to Settings > Prompts tab
        setActiveTab('settings')
        useStore.setState({ settingsActiveTab: 1 })
        break
      case 'execute':
        // Open NewPromptModal in execute mode (library selection)
        useStore.setState({ promptActionMode: 'execute' })
        setNewPromptModalOpen(true)
        break
      case 'healthcheck':
        // Switch to Health Checks tab on Prompts page
        useStore.setState({ promptsActiveTab: 'healthchecks', showHealthCheckModal: true })
        break
      default:
        break
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-quant-card rounded-t-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-quant-border">
          <div>
            <h2 className="text-lg font-bold text-white">What would you like to do?</h2>
            <p className="text-xs text-gray-500">Select an action to get started</p>
          </div>
          <button
            onClick={handleClose}
            className="p-3 -mr-1 rounded-full hover:bg-quant-surface transition-colors active:scale-90"
          >
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-3">
          {actions.map((action, index) => {
            const Icon = action.icon
            return (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleAction(action.id)}
                className={`w-full p-4 rounded-2xl border ${action.bgColor} ${action.borderColor} text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center`}>
                    <Icon size={24} className={`text-${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-0.5">{action.label}</h3>
                    <p className="text-xs text-gray-400">{action.description}</p>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Safe area padding */}
        <div className="h-6 safe-area-bottom" />
      </motion.div>
    </motion.div>
  )
}
