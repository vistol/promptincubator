import { motion } from 'framer-motion'
import { Egg, Radio, Sparkles, Settings } from 'lucide-react'
import useStore from '../store/useStore'

const tabs = [
  { id: 'prompts', label: 'Prompts', icon: Sparkles },
  { id: 'incubator', label: 'Incubator', icon: Egg },
  { id: 'signals', label: 'Signals', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function BottomNav() {
  const activeTab = useStore((state) => state.activeTab) || 'prompts'
  const setActiveTab = useStore((state) => state.setActiveTab)
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-quant-card/95 backdrop-blur-lg border-t border-quant-border safe-area-bottom z-50">
      <div className="relative flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        <motion.div
          className="absolute top-0 w-8 h-0.5 bg-accent-cyan rounded-full"
          animate={{ left: `calc(${(activeIndex + 0.5) * 25}% - 1rem)` }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center w-full h-full"
            >
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  y: isActive ? -2 : 0
                }}
                className="relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="navGlow"
                    className="absolute -inset-3 bg-accent-cyan/20 rounded-full blur-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
                <Icon
                  size={24}
                  className={`relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-accent-cyan' : 'text-gray-500'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${
                  isActive ? 'text-accent-cyan' : 'text-gray-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
