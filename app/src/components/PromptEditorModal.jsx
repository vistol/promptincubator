import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Save, FileText, Check, AlertCircle, Type, AlignLeft, Lightbulb } from 'lucide-react'
import useStore from '../store/useStore'

// Strategy writing tips
const WRITING_TIPS = [
  "Be specific about indicators (RSI, MACD, Moving Averages)",
  "Include timeframes (1H, 4H, Daily)",
  "Mention price levels (support, resistance, fibonacci)",
  "Describe volume conditions",
  "Add entry/exit criteria",
  "Consider market context (trend, range)"
]

export default function PromptEditorModal({ prompt, onClose, onSave }) {
  const { addPrompt, updatePrompt } = useStore()
  const isEditing = !!prompt
  const textareaRef = useRef(null)

  const [name, setName] = useState(prompt?.name || '')
  const [content, setContent] = useState(prompt?.content || '')
  const [isSaving, setIsSaving] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(300, textareaRef.current.scrollHeight)}px`
    }
  }, [content])

  // Character and word count
  const charCount = content.length
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  const handleSave = async () => {
    if (!name.trim()) return

    setIsSaving(true)

    const promptData = {
      name: name.trim(),
      content: content.trim() || name.trim(),
      status: 'active'
    }

    // Simulate a brief save delay for feedback
    await new Promise(resolve => setTimeout(resolve, 300))

    if (isEditing) {
      updatePrompt(prompt.id, promptData)
    } else {
      addPrompt(promptData)
    }

    setLastSaved(new Date())
    setIsSaving(false)
    onSave?.()
    onClose()
  }

  const canSave = name.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-quant-bg"
    >
      {/* Full-screen editor container */}
      <div className="h-full flex flex-col">
        {/* Header - Fixed */}
        <header className="shrink-0 bg-quant-card border-b border-quant-border">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-3 -ml-1 rounded-lg hover:bg-quant-surface transition-colors active:scale-90"
              >
                <X size={22} className="text-gray-400" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
                  <FileText size={16} className="text-accent-cyan" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-white">
                    {isEditing ? 'Edit Strategy' : 'New Strategy'}
                  </h1>
                  <p className="text-[10px] text-gray-500">
                    {lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Unsaved changes'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tips Toggle */}
              <button
                onClick={() => setShowTips(!showTips)}
                className={`p-2 rounded-lg transition-colors ${
                  showTips ? 'bg-accent-yellow/20 text-accent-yellow' : 'hover:bg-quant-surface text-gray-400'
                }`}
                title="Writing tips"
              >
                <Lightbulb size={18} />
              </button>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={!canSave || isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan text-quant-bg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-cyan/90 transition-colors"
              >
                {isSaving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Save size={16} />
                    </motion.div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {isEditing ? 'Update' : 'Save'}
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Tips Panel */}
        {showTips && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 bg-accent-yellow/5 border-b border-accent-yellow/20"
          >
            <div className="max-w-4xl mx-auto px-4 py-3">
              <div className="flex items-start gap-2">
                <Lightbulb size={14} className="text-accent-yellow shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-accent-yellow font-medium mb-2">Writing Tips for Better Strategies:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {WRITING_TIPS.map((tip, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                        <Check size={10} className="text-accent-yellow shrink-0 mt-0.5" />
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Editor Area - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Strategy Name */}
            <div className="mb-6">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Strategy Name"
                className="w-full bg-transparent text-2xl md:text-3xl font-bold text-white placeholder-gray-600 focus:outline-none border-none"
                autoFocus
              />
              {!name.trim() && (
                <p className="text-xs text-accent-red mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Name is required
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-quant-border mb-6" />

            {/* Content Editor */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe your trading strategy here...

Write your strategy in plain language. Be as detailed as you want - the more specific you are, the better the AI can find matching opportunities.

Example:
I'm looking for cryptocurrencies that are showing signs of a potential reversal. Specifically:

1. RSI (14) below 30 on the 4-hour chart, indicating oversold conditions
2. Price is within 5% of a significant support level (previous lows or fibonacci retracement)
3. Volume has increased by at least 20% compared to the 20-period average
4. The overall market (BTC) is not in a strong downtrend

I prefer to enter slightly below the current price to get a better risk/reward ratio. My target is a move back to the middle of the recent range, with a stop loss just below the support level."
                className="w-full bg-transparent text-base md:text-lg text-gray-200 placeholder-gray-600 focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: '300px' }}
              />

              {/* Writing Stats */}
              <div className="sticky bottom-0 left-0 right-0 py-3 bg-gradient-to-t from-quant-bg via-quant-bg to-transparent">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Type size={12} />
                      {charCount} characters
                    </span>
                    <span className="flex items-center gap-1">
                      <AlignLeft size={12} />
                      {wordCount} words
                    </span>
                  </div>
                  <span>
                    {charCount < 50 && (
                      <span className="text-accent-yellow">Add more detail for better results</span>
                    )}
                    {charCount >= 50 && charCount < 200 && (
                      <span className="text-accent-cyan">Good start!</span>
                    )}
                    {charCount >= 200 && (
                      <span className="text-accent-green">Great level of detail</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer - Mobile Save Button */}
        <footer className="shrink-0 md:hidden bg-quant-card border-t border-quant-border p-4">
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent-cyan text-quant-bg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Save size={18} />
                </motion.div>
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                {isEditing ? 'Update Strategy' : 'Save Strategy'}
              </>
            )}
          </button>
        </footer>
      </div>
    </motion.div>
  )
}
