import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'

export default function FAB({ onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed right-4 bottom-24 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-accent-cyan to-electric-600 flex items-center justify-center shadow-lg"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      style={{
        boxShadow: '0 0 30px rgba(0, 240, 255, 0.4)'
      }}
    >
      <Plus size={28} className="text-quant-bg" strokeWidth={2.5} />
    </motion.button>
  )
}
