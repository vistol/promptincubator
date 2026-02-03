import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, FileText, Database, ChevronRight, Eye, EyeOff, Check, X, AlertCircle, Edit3, Plus, Crown, ChevronDown, ChevronUp, Cloud, RefreshCw, Download, Upload, Activity, TrendingUp, Trash2, Link, Unlink, Info, Egg, BarChart3, ScrollText, Zap } from 'lucide-react'
import useStore from '../store/useStore'
import Header from '../components/Header'
import PromptEditorModal from '../components/PromptEditorModal'
import { testAPIConnection } from '../lib/aiService'

const tabs = ['AI Provider', 'Prompts', 'System']

const tradingPlatforms = [
  {
    id: 'binance',
    name: 'Binance',
    description: 'Largest crypto exchange by volume',
    icon: '🔶',
    color: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'tradingview',
    name: 'TradingView',
    description: 'Advanced charting platform',
    icon: '📊',
    color: 'from-blue-500 to-purple-500'
  }
]

const aiProviders = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    icon: '🧠',
    color: 'from-orange-500 to-amber-500',
    apiUrl: 'https://console.anthropic.com/settings/keys',
    apiLabel: 'Get API key from Anthropic Console'
  },
  {
    id: 'google',
    name: 'Google',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
    icon: '🔮',
    color: 'from-blue-500 to-cyan-500',
    apiUrl: 'https://aistudio.google.com/apikey',
    apiLabel: 'Get free API key from Google AI Studio'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    icon: '🤖',
    color: 'from-green-500 to-emerald-500',
    apiUrl: 'https://platform.openai.com/api-keys',
    apiLabel: 'Get API key from OpenAI Platform'
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    models: ['grok-beta', 'grok-2'],
    icon: '⚡',
    color: 'from-orange-500 to-red-500',
    apiUrl: 'https://console.x.ai/',
    apiLabel: 'Get API key from xAI Console'
  }
]

export default function Settings() {
  const {
    settings,
    prompts,
    updateSettings,
    updateApiKey,
    updateSupabase,
    updateTradingPlatform,
    updatePrompt,
    updateSystemPrompt,
    addPrompt,
    syncToCloud,
    loadFromCloud,
    repairEggsInCloud,
    syncStatus,
    priceStatus,
    refreshPrices,
    resetAllData,
    resetSelectiveData,
    getDataCounts,
    eggs,
    signals,
    settingsActiveTab,
    setSettingsActiveTab
  } = useStore()

  const activeTab = settingsActiveTab
  const setActiveTab = setSettingsActiveTab
  const [showApiKey, setShowApiKey] = useState({})
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState(null)
  const [editingSystemPrompt, setEditingSystemPrompt] = useState(false)
  const [systemPromptContent, setSystemPromptContent] = useState(settings.systemPrompt || '')
  const [systemPromptExpanded, setSystemPromptExpanded] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // API Key testing state
  const [testingApi, setTestingApi] = useState({})
  const [apiTestResult, setApiTestResult] = useState({})
  const [apiKeySaved, setApiKeySaved] = useState({})

  // Test API connection using centralized function with Vite proxy
  const testApiConnection = async (providerId, apiKey) => {
    if (!apiKey || apiKey.length < 10) {
      setApiTestResult({ ...apiTestResult, [providerId]: { success: false, error: 'API key too short' } })
      return
    }

    setTestingApi({ ...testingApi, [providerId]: true })
    setApiTestResult({ ...apiTestResult, [providerId]: null })

    try {
      const result = await testAPIConnection(providerId, apiKey)

      if (result.success) {
        setApiTestResult({ ...apiTestResult, [providerId]: { success: true } })
        setApiKeySaved({ ...apiKeySaved, [providerId]: true })
      } else {
        setApiTestResult({
          ...apiTestResult,
          [providerId]: { success: false, error: result.message }
        })
      }
    } catch (error) {
      setApiTestResult({
        ...apiTestResult,
        [providerId]: { success: false, error: error.message }
      })
    }

    setTestingApi({ ...testingApi, [providerId]: false })
  }

  // Handle API key change
  const handleApiKeyChange = (providerId, value) => {
    updateApiKey(providerId, value)
    setApiKeySaved({ ...apiKeySaved, [providerId]: false })
    setApiTestResult({ ...apiTestResult, [providerId]: null })
  }

  // Selective delete state
  const [deleteOptions, setDeleteOptions] = useState({
    deletePrompts: false,
    deleteEggs: false,
    deleteSignals: false,
    deleteLogs: false,
    resetOnboarding: false,
    keepLinkedData: true
  })
  const [deleteResult, setDeleteResult] = useState(null)
  const [isResetting, setIsResetting] = useState(false)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [editingPromptData, setEditingPromptData] = useState(null)
  const [isRepairing, setIsRepairing] = useState(false)
  const [repairResult, setRepairResult] = useState(null)

  // Get current data counts
  const dataCounts = getDataCounts()

  // Calculate what will be affected by deletion
  const getDeleteImpact = () => {
    const impact = []
    const warnings = []

    if (deleteOptions.deletePrompts) {
      impact.push(`${prompts.length} prompts`)
      if (!deleteOptions.keepLinkedData && eggs.length > 0) {
        const linkedEggs = eggs.filter(e => prompts.some(p => p.id === e.promptId))
        if (linkedEggs.length > 0) {
          warnings.push(`${linkedEggs.length} eggs will also be deleted (linked to prompts)`)
          const linkedSignals = signals.filter(s => linkedEggs.some(e => e.trades.includes(s.id)))
          if (linkedSignals.length > 0) {
            warnings.push(`${linkedSignals.length} signals will also be deleted (linked to those eggs)`)
          }
        }
      } else if (deleteOptions.keepLinkedData && eggs.length > 0) {
        const linkedEggs = eggs.filter(e => prompts.some(p => p.id === e.promptId))
        if (linkedEggs.length > 0) {
          warnings.push(`${linkedEggs.length} eggs will become orphaned (marked as "deleted" prompt)`)
        }
      }
    }

    if (deleteOptions.deleteEggs) {
      impact.push(`${eggs.length} eggs`)
      if (!deleteOptions.keepLinkedData) {
        const eggSignalIds = eggs.flatMap(e => e.trades)
        const linkedSignals = signals.filter(s => eggSignalIds.includes(s.id))
        if (linkedSignals.length > 0) {
          warnings.push(`${linkedSignals.length} signals will also be deleted (linked to eggs)`)
        }
      }
    }

    if (deleteOptions.deleteSignals) {
      impact.push(`${signals.length} signals/trades`)
      const eggsWithSignals = eggs.filter(e => e.trades.length > 0)
      if (eggsWithSignals.length > 0) {
        warnings.push(`${eggsWithSignals.length} eggs will lose their trade references`)
      }
    }

    if (deleteOptions.deleteLogs) {
      impact.push(`${dataCounts.activityLogs} activity logs`)
    }

    if (deleteOptions.resetOnboarding) {
      impact.push('onboarding status (will show setup wizard again)')
    }

    return { impact, warnings }
  }

  const handleSelectiveDelete = () => {
    const result = resetSelectiveData(deleteOptions)
    setDeleteResult(result)
    setShowResetConfirm(false)

    // Reset options after delete
    setTimeout(() => {
      setDeleteOptions({
        deletePrompts: false,
        deleteEggs: false,
        deleteSignals: false,
        deleteLogs: false,
        resetOnboarding: false,
        keepLinkedData: true
      })
      setDeleteResult(null)
    }, 3000)
  }

  const anyDeleteSelected = deleteOptions.deletePrompts || deleteOptions.deleteEggs ||
    deleteOptions.deleteSignals || deleteOptions.deleteLogs || deleteOptions.resetOnboarding

  const handleSaveSystemPrompt = () => {
    updateSystemPrompt(systemPromptContent)
    setEditingSystemPrompt(false)
  }


  const testSupabaseConnection = async () => {
    setTestingConnection(true)
    setConnectionResult(null)

    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 1500))

    const success = settings.supabase.url && settings.supabase.anonKey
    setConnectionResult(success ? 'success' : 'error')
    if (success) {
      updateSupabase({ connected: true })
    }
    setTestingConnection(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Header title="Settings" subtitle="Configure your app" />

      {/* Tabs */}
      <div className="px-4 py-3">
        <div className="flex bg-quant-surface rounded-xl p-1">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              onClick={() => setActiveTab(index)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === index
                  ? 'bg-quant-card text-white shadow'
                  : 'text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-4">
        <AnimatePresence mode="wait">
          {/* AI Provider Tab */}
          {activeTab === 0 && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Provider Selection */}
              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Select Provider</label>
                {aiProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => updateSettings({ aiProvider: provider.id })}
                    className={`w-full bg-quant-card border rounded-xl p-4 text-left transition-all ${
                      settings.aiProvider === provider.id
                        ? 'border-accent-cyan'
                        : 'border-quant-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="text-2xl">{provider.icon}</span>
                          {settings.apiKeys[provider.id] && (
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-quant-card ${
                              apiTestResult[provider.id]?.success ? 'bg-accent-green' : 'bg-accent-yellow'
                            }`} />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{provider.name}</span>
                          <span className="text-xs text-gray-500">
                            {settings.apiKeys[provider.id]
                              ? apiTestResult[provider.id]?.success
                                ? '✓ Connected'
                                : 'Key saved - test to verify'
                              : 'No API key'
                            }
                          </span>
                        </div>
                      </div>
                      {settings.aiProvider === provider.id && (
                        <div className="w-5 h-5 rounded-full bg-accent-cyan flex items-center justify-center">
                          <Check size={14} className="text-quant-bg" />
                        </div>
                      )}
                    </div>

                    {/* API Key Input */}
                    {settings.aiProvider === provider.id && (
                      <div className="mt-4 pt-4 border-t border-quant-border">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-gray-400">API Key</label>
                          <a
                            href={provider.apiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-accent-cyan hover:underline flex items-center gap-1"
                          >
                            {provider.apiLabel}
                            <ChevronRight size={12} />
                          </a>
                        </div>
                        <div className="relative">
                          <input
                            type={showApiKey[provider.id] ? 'text' : 'password'}
                            value={settings.apiKeys[provider.id] || ''}
                            onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                            placeholder="Enter your API key"
                            className={`w-full bg-quant-surface border rounded-lg px-4 py-2.5 pr-10 text-white text-sm font-mono ${
                              apiTestResult[provider.id]?.success
                                ? 'border-accent-green'
                                : apiTestResult[provider.id]?.error
                                  ? 'border-accent-red'
                                  : 'border-quant-border'
                            }`}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowApiKey({ ...showApiKey, [provider.id]: !showApiKey[provider.id] })
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showApiKey[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>

                        {/* Test Connection Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            testApiConnection(provider.id, settings.apiKeys[provider.id])
                          }}
                          disabled={!settings.apiKeys[provider.id] || testingApi[provider.id]}
                          className={`w-full mt-3 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                            testingApi[provider.id]
                              ? 'bg-quant-surface text-gray-400'
                              : apiTestResult[provider.id]?.success
                                ? 'bg-accent-green/20 text-accent-green'
                                : 'bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30'
                          }`}
                        >
                          {testingApi[provider.id] ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              Testing...
                            </>
                          ) : apiTestResult[provider.id]?.success ? (
                            <>
                              <Check size={14} />
                              Connected & Saved!
                            </>
                          ) : (
                            <>
                              <Zap size={14} />
                              Test Connection
                            </>
                          )}
                        </button>

                        {/* Test Result Message */}
                        {apiTestResult[provider.id]?.error && (
                          <div className="mt-2 p-2 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs flex items-start gap-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span>{apiTestResult[provider.id].error}</span>
                          </div>
                        )}

                        {apiTestResult[provider.id]?.success && (
                          <div className="mt-2 p-2 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs flex items-center gap-2">
                            <Check size={14} />
                            <span>API key verified and saved successfully!</span>
                          </div>
                        )}

                        {/* Model Selection */}
                        <label className="text-xs text-gray-400 block mt-4 mb-2">Model</label>
                        <div className="flex flex-wrap gap-2">
                          {provider.models.map((model) => (
                            <button
                              key={model}
                              onClick={(e) => {
                                e.stopPropagation()
                                updateSettings({ aiModel: model })
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                                settings.aiModel === model
                                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                                  : 'bg-quant-surface text-gray-400 border border-transparent'
                              }`}
                            >
                              {model}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Prompts Tab */}
          {activeTab === 1 && (
            <motion.div
              key="prompts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* System Prompt (Parent) - Most Important */}
              <div className="bg-gradient-to-br from-accent-cyan/10 to-electric-600/10 border-2 border-accent-cyan/30 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-accent-cyan/20">
                        <Crown size={18} className="text-accent-cyan" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">System Prompt</h3>
                        <span className="text-xs text-accent-cyan">Parent prompt for AUTO mode</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (editingSystemPrompt) {
                            handleSaveSystemPrompt()
                          } else {
                            setEditingSystemPrompt(true)
                            setSystemPromptContent(settings.systemPrompt || '')
                          }
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          editingSystemPrompt
                            ? 'bg-accent-green/20 text-accent-green'
                            : 'hover:bg-quant-surface text-gray-400'
                        }`}
                      >
                        {editingSystemPrompt ? <Check size={16} /> : <Edit3 size={16} />}
                      </button>
                      {!editingSystemPrompt && (
                        <button
                          onClick={() => setSystemPromptExpanded(!systemPromptExpanded)}
                          className="p-2 rounded-lg hover:bg-quant-surface text-gray-400 transition-colors"
                        >
                          {systemPromptExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {editingSystemPrompt ? (
                    <div className="space-y-3">
                      <textarea
                        value={systemPromptContent}
                        onChange={(e) => setSystemPromptContent(e.target.value)}
                        className="w-full bg-quant-surface border border-quant-border rounded-lg px-3 py-2 text-sm text-white font-mono resize-none"
                        rows={15}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingSystemPrompt(false)}
                          className="flex-1 py-2 rounded-lg bg-quant-surface text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveSystemPrompt}
                          className="flex-1 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={`text-sm text-gray-400 font-mono ${systemPromptExpanded ? '' : 'line-clamp-3'}`}>
                        {settings.systemPrompt}
                      </p>
                      {!systemPromptExpanded && (
                        <button
                          onClick={() => setSystemPromptExpanded(true)}
                          className="text-xs text-accent-cyan mt-2 hover:underline"
                        >
                          Show full prompt...
                        </button>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-accent-cyan/20">
                    <span className="text-xs text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded-full">
                      MASTER TEMPLATE
                    </span>
                    <span className="text-xs text-gray-500">
                      All AUTO prompts inherit from this
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-quant-border" />
                <span className="text-xs text-gray-500">Child Prompts</span>
                <div className="flex-1 h-px bg-quant-border" />
              </div>

              {/* Add New Button */}
              <button
                onClick={() => {
                  setEditingPromptData(null)
                  setShowPromptEditor(true)
                }}
                className="w-full bg-quant-surface border border-dashed border-quant-border rounded-xl p-4 flex items-center justify-center gap-2 text-gray-400 hover:border-accent-cyan hover:text-accent-cyan transition-all"
              >
                <Plus size={18} />
                <span>Create New Prompt</span>
              </button>

              {/* Prompts List */}
              <div className="space-y-3">
                {prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="bg-quant-card border border-quant-border rounded-xl overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-white">{prompt.name}</h3>
                        <button
                          onClick={() => {
                            setEditingPromptData(prompt)
                            setShowPromptEditor(true)
                          }}
                          className="p-2 rounded-lg transition-colors hover:bg-quant-surface text-gray-400"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>

                      <p className="text-sm text-gray-400 font-mono line-clamp-2">
                        {prompt.content}
                      </p>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-quant-border">
                        <span className="text-xs text-gray-500">
                          {prompt.content ? `${prompt.content.length} chars` : 'No description'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* System Tab */}
          {activeTab === 2 && (
            <motion.div
              key="system"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Trading Platforms */}
              <div className="bg-quant-card border border-quant-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-accent-green/20">
                    <Activity size={20} className="text-accent-green" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Trading Platforms</h3>
                    <span className="text-xs text-gray-500">Real-time price data sources</span>
                  </div>
                  {priceStatus.lastUpdated && (
                    <div className="flex items-center gap-1 text-xs">
                      <div className={`w-2 h-2 rounded-full ${priceStatus.error ? 'bg-accent-red' : 'bg-accent-green'} animate-pulse`} />
                      <span className="text-gray-400">
                        {priceStatus.source === 'binance' ? 'BN' : 'TV'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Primary Platform */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-accent-cyan/20 flex items-center justify-center text-[10px] text-accent-cyan font-bold">1</span>
                      Primary Platform
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {tradingPlatforms.map((platform) => (
                        <button
                          key={platform.id}
                          onClick={() => updateTradingPlatform({ primary: platform.id })}
                          className={`p-3 rounded-xl border transition-all ${
                            settings.tradingPlatform?.primary === platform.id
                              ? 'bg-accent-cyan/10 border-accent-cyan'
                              : 'bg-quant-surface border-quant-border hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{platform.icon}</span>
                            <div className="text-left">
                              <span className="text-sm font-medium text-white block">{platform.name}</span>
                              <span className="text-[10px] text-gray-500">{platform.description}</span>
                            </div>
                          </div>
                          {settings.tradingPlatform?.primary === platform.id && (
                            <div className="flex justify-end mt-2">
                              <Check size={14} className="text-accent-cyan" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Platform (Fallback) */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-accent-yellow/20 flex items-center justify-center text-[10px] text-accent-yellow font-bold">2</span>
                      Fallback Platform
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {tradingPlatforms
                        .filter(p => p.id !== settings.tradingPlatform?.primary)
                        .map((platform) => (
                          <button
                            key={platform.id}
                            onClick={() => updateTradingPlatform({ secondary: platform.id })}
                            className={`p-3 rounded-xl border transition-all ${
                              settings.tradingPlatform?.secondary === platform.id
                                ? 'bg-accent-yellow/10 border-accent-yellow'
                                : 'bg-quant-surface border-quant-border hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{platform.icon}</span>
                              <div className="text-left">
                                <span className="text-sm font-medium text-white block">{platform.name}</span>
                                <span className="text-[10px] text-gray-500">Backup source</span>
                              </div>
                            </div>
                            {settings.tradingPlatform?.secondary === platform.id && (
                              <div className="flex justify-end mt-2">
                                <Check size={14} className="text-accent-yellow" />
                              </div>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Price Status */}
                  <div className="pt-3 border-t border-quant-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-400">Price Refresh</span>
                      <span className="text-xs text-gray-500">Every 15 minutes</span>
                    </div>

                    <button
                      onClick={() => refreshPrices()}
                      disabled={priceStatus.isFetching}
                      className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                        priceStatus.isFetching
                          ? 'bg-quant-surface text-gray-400'
                          : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                      }`}
                    >
                      <RefreshCw size={16} className={priceStatus.isFetching ? 'animate-spin' : ''} />
                      {priceStatus.isFetching ? 'Fetching Prices...' : 'Refresh Prices Now'}
                    </button>

                    {/* Last Update Info */}
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <span className="text-gray-500">Last updated:</span>
                      <span className="text-gray-400 font-mono">
                        {priceStatus.lastUpdated
                          ? new Date(priceStatus.lastUpdated).toLocaleString()
                          : 'Never'
                        }
                      </span>
                    </div>

                    {priceStatus.fallbackUsed && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-yellow/20 text-accent-yellow text-xs mt-2">
                        <AlertCircle size={14} />
                        <span>Using fallback platform (primary unavailable)</span>
                      </div>
                    )}

                    {priceStatus.error && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-red/20 text-accent-red text-xs mt-2">
                        <AlertCircle size={14} />
                        <span>{priceStatus.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Supabase */}
              <div className="bg-quant-card border border-quant-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-accent-cyan/20">
                    <Database size={20} className="text-accent-cyan" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Supabase</h3>
                    <span className="text-xs text-gray-500">Cloud database connection</span>
                  </div>
                  {settings.supabase.connected && (
                    <div className="ml-auto flex items-center gap-1 text-accent-green text-xs">
                      <Check size={14} />
                      Connected
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Project URL</label>
                    <input
                      type="text"
                      value={settings.supabase.url || ''}
                      onChange={(e) => updateSupabase({ url: e.target.value, connected: false })}
                      placeholder="https://xxx.supabase.co"
                      className="w-full bg-quant-surface border border-quant-border rounded-lg px-4 py-2.5 text-white text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Anon Key</label>
                    <input
                      type="password"
                      value={settings.supabase.anonKey || ''}
                      onChange={(e) => updateSupabase({ anonKey: e.target.value, connected: false })}
                      placeholder="eyJhbGci..."
                      className="w-full bg-quant-surface border border-quant-border rounded-lg px-4 py-2.5 text-white text-sm font-mono"
                    />
                  </div>

                  <button
                    onClick={testSupabaseConnection}
                    disabled={testingConnection}
                    className={`w-full py-3 rounded-xl font-medium transition-all ${
                      testingConnection
                        ? 'bg-quant-surface text-gray-400'
                        : 'bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30'
                    }`}
                  >
                    {testingConnection ? 'Testing Connection...' : 'Test Connection'}
                  </button>

                  {connectionResult && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                      connectionResult === 'success'
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-accent-red/20 text-accent-red'
                    }`}>
                      {connectionResult === 'success' ? (
                        <>
                          <Check size={16} />
                          <span className="text-sm">Connection successful!</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} />
                          <span className="text-sm">Connection failed. Check your credentials.</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Sync Actions */}
                  {settings.supabase.url && settings.supabase.anonKey && (
                    <div className="pt-4 border-t border-quant-border space-y-3">
                      <h4 className="text-xs text-gray-400 uppercase tracking-wider">Data Sync</h4>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => syncToCloud()}
                          disabled={syncStatus.syncing}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-quant-surface border border-quant-border text-gray-400 hover:text-white hover:border-accent-cyan/50 transition-all disabled:opacity-50"
                        >
                          {syncStatus.syncing ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          <span className="text-sm">Push to Cloud</span>
                        </button>

                        <button
                          onClick={() => loadFromCloud()}
                          disabled={syncStatus.loading}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-quant-surface border border-quant-border text-gray-400 hover:text-white hover:border-accent-cyan/50 transition-all disabled:opacity-50"
                        >
                          {syncStatus.loading ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Download size={16} />
                          )}
                          <span className="text-sm">Pull from Cloud</span>
                        </button>
                      </div>

                      {/* Sync Status */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Last synced:</span>
                        <span className="text-gray-400 font-mono">
                          {syncStatus.lastSynced
                            ? new Date(syncStatus.lastSynced).toLocaleString()
                            : 'Never'
                          }
                        </span>
                      </div>

                      {syncStatus.error && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-red/20 text-accent-red text-xs">
                          <AlertCircle size={14} />
                          <span>{syncStatus.error}</span>
                        </div>
                      )}

                      {/* Repair Eggs Data */}
                      <div className="pt-3 border-t border-quant-border">
                        <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Data Repair</h4>
                        <p className="text-xs text-gray-500 mb-3">
                          Regenera campos vacíos (prompt_content, full_ai_prompt, config) en eggs existentes
                        </p>
                        <button
                          onClick={async () => {
                            setIsRepairing(true)
                            setRepairResult(null)
                            try {
                              const result = await repairEggsInCloud()
                              setRepairResult(result)
                            } catch (err) {
                              setRepairResult({ success: false, error: err.message })
                            }
                            setIsRepairing(false)
                          }}
                          disabled={isRepairing}
                          className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                            isRepairing
                              ? 'bg-quant-surface text-gray-400'
                              : 'bg-accent-orange/20 text-accent-orange hover:bg-accent-orange/30'
                          }`}
                        >
                          {isRepairing ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              Reparando eggs...
                            </>
                          ) : (
                            <>
                              <Cpu size={14} />
                              Reparar Datos de Eggs
                            </>
                          )}
                        </button>

                        {repairResult && (
                          <div className={`mt-2 p-2 rounded-lg text-xs flex items-start gap-2 ${
                            repairResult.success
                              ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
                              : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
                          }`}>
                            {repairResult.success ? (
                              <>
                                <Check size={14} className="shrink-0 mt-0.5" />
                                <span>
                                  {repairResult.repaired > 0
                                    ? `Reparados ${repairResult.repaired}/${repairResult.total} eggs`
                                    : `Todos los ${repairResult.total} eggs tienen datos válidos`
                                  }
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <span>{repairResult.error}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* App Info */}
              <div className="bg-quant-card border border-quant-border rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">App Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Version</span>
                    <span className="text-white font-mono">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Build</span>
                    <span className="text-white font-mono">2024.01.22</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Storage</span>
                    <span className="text-white font-mono">Local + Cloud</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-quant-card border border-accent-red/30 rounded-xl p-4">
                <h3 className="font-semibold text-accent-red mb-4 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Danger Zone
                </h3>

                {/* Current Data Summary */}
                <div className="bg-quant-surface rounded-xl p-3 mb-4">
                  <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Current Data</span>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-accent-cyan" />
                      <span className="text-gray-400">Prompts:</span>
                      <span className="text-white font-mono">{dataCounts.prompts}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Egg size={14} className="text-accent-yellow" />
                      <span className="text-gray-400">Eggs:</span>
                      <span className="text-white font-mono">{dataCounts.eggs}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 size={14} className="text-accent-green" />
                      <span className="text-gray-400">Signals:</span>
                      <span className="text-white font-mono">{dataCounts.signals}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScrollText size={14} className="text-accent-purple" />
                      <span className="text-gray-400">Logs:</span>
                      <span className="text-white font-mono">{dataCounts.activityLogs}</span>
                    </div>
                  </div>
                </div>

                {/* Select Data to Delete */}
                <div className="space-y-3 mb-4">
                  <span className="text-xs text-gray-500 uppercase tracking-wider block">Select Data to Delete</span>

                  {/* Prompts */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    deleteOptions.deletePrompts
                      ? 'bg-accent-red/10 border-accent-red/50'
                      : 'bg-quant-surface border-quant-border hover:border-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={deleteOptions.deletePrompts}
                      onChange={(e) => setDeleteOptions({ ...deleteOptions, deletePrompts: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-quant-surface text-accent-red focus:ring-accent-red"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium flex items-center gap-2">
                          <FileText size={14} className="text-accent-cyan" />
                          Prompts
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{dataCounts.prompts} items</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Trading strategies and configurations you've created
                      </p>
                      {deleteOptions.deletePrompts && eggs.length > 0 && (
                        <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-accent-orange/10 text-accent-orange text-xs">
                          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                          <span>
                            {eggs.filter(e => prompts.some(p => p.id === e.promptId)).length} eggs are linked to these prompts
                          </span>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Eggs */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    deleteOptions.deleteEggs
                      ? 'bg-accent-red/10 border-accent-red/50'
                      : 'bg-quant-surface border-quant-border hover:border-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={deleteOptions.deleteEggs}
                      onChange={(e) => setDeleteOptions({ ...deleteOptions, deleteEggs: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-quant-surface text-accent-red focus:ring-accent-red"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium flex items-center gap-2">
                          <Egg size={14} className="text-accent-yellow" />
                          Eggs
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {dataCounts.incubatingEggs} live, {dataCounts.hatchedEggs} hatched
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Incubating and hatched trade groups with their results
                      </p>
                      {deleteOptions.deleteEggs && signals.length > 0 && (
                        <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-accent-orange/10 text-accent-orange text-xs">
                          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                          <span>
                            {eggs.flatMap(e => e.trades).filter(id => signals.some(s => s.id === id)).length} signals are linked to these eggs
                          </span>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Signals */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    deleteOptions.deleteSignals
                      ? 'bg-accent-red/10 border-accent-red/50'
                      : 'bg-quant-surface border-quant-border hover:border-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={deleteOptions.deleteSignals}
                      onChange={(e) => setDeleteOptions({ ...deleteOptions, deleteSignals: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-quant-surface text-accent-red focus:ring-accent-red"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium flex items-center gap-2">
                          <BarChart3 size={14} className="text-accent-green" />
                          Signals / Trades
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {dataCounts.activeSignals} active, {dataCounts.closedSignals} closed
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        All trade signals including active positions and history
                      </p>
                      {deleteOptions.deleteSignals && eggs.some(e => e.trades.length > 0) && (
                        <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-accent-orange/10 text-accent-orange text-xs">
                          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                          <span>
                            Eggs will lose their trade data references
                          </span>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Activity Logs */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    deleteOptions.deleteLogs
                      ? 'bg-accent-red/10 border-accent-red/50'
                      : 'bg-quant-surface border-quant-border hover:border-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={deleteOptions.deleteLogs}
                      onChange={(e) => setDeleteOptions({ ...deleteOptions, deleteLogs: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-quant-surface text-accent-red focus:ring-accent-red"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium flex items-center gap-2">
                          <ScrollText size={14} className="text-accent-purple" />
                          Activity Logs
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{dataCounts.activityLogs} entries</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Monitoring console history (prices, syncs, trades)
                      </p>
                    </div>
                  </label>

                  {/* Reset Onboarding */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    deleteOptions.resetOnboarding
                      ? 'bg-accent-red/10 border-accent-red/50'
                      : 'bg-quant-surface border-quant-border hover:border-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={deleteOptions.resetOnboarding}
                      onChange={(e) => setDeleteOptions({ ...deleteOptions, resetOnboarding: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-quant-surface text-accent-red focus:ring-accent-red"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium flex items-center gap-2">
                          <Info size={14} className="text-gray-400" />
                          Reset Onboarding
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Show the initial setup wizard again on next app launch
                      </p>
                    </div>
                  </label>
                </div>

                {/* Linked Data Handling */}
                {(deleteOptions.deletePrompts || deleteOptions.deleteEggs || deleteOptions.deleteSignals) && (
                  <div className="bg-quant-surface rounded-xl p-3 mb-4">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                      Linked Data Handling
                    </span>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="linkedData"
                          checked={deleteOptions.keepLinkedData}
                          onChange={() => setDeleteOptions({ ...deleteOptions, keepLinkedData: true })}
                          className="w-4 h-4 border-gray-600 bg-quant-surface text-accent-cyan focus:ring-accent-cyan"
                        />
                        <div>
                          <span className="text-white text-sm flex items-center gap-2">
                            <Link size={12} className="text-accent-cyan" />
                            Keep linked data (safe)
                          </span>
                          <p className="text-xs text-gray-500">
                            Orphan linked items instead of deleting them
                          </p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="linkedData"
                          checked={!deleteOptions.keepLinkedData}
                          onChange={() => setDeleteOptions({ ...deleteOptions, keepLinkedData: false })}
                          className="w-4 h-4 border-gray-600 bg-quant-surface text-accent-red focus:ring-accent-red"
                        />
                        <div>
                          <span className="text-white text-sm flex items-center gap-2">
                            <Unlink size={12} className="text-accent-red" />
                            Cascade delete (destructive)
                          </span>
                          <p className="text-xs text-gray-500">
                            Also delete all data linked to selected items
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Delete Result Message */}
                {deleteResult && (
                  <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-3 mb-4">
                    <div className="flex items-center gap-2 text-accent-green text-sm">
                      <Check size={16} />
                      <span>Data deleted successfully</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Removed: {deleteResult.deletedPrompts} prompts, {deleteResult.deletedEggs} eggs,
                      {deleteResult.deletedSignals} signals, {deleteResult.deletedLogs} logs
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => anyDeleteSelected && setShowResetConfirm(true)}
                    disabled={!anyDeleteSelected}
                    className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      anyDeleteSelected
                        ? 'bg-accent-red/20 text-accent-red hover:bg-accent-red/30'
                        : 'bg-quant-surface text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 size={16} />
                    Delete Selected Data
                  </button>

                  <button
                    onClick={() => {
                      setDeleteOptions({
                        deletePrompts: true,
                        deleteEggs: true,
                        deleteSignals: true,
                        deleteLogs: true,
                        resetOnboarding: true,
                        keepLinkedData: false
                      })
                      setShowResetConfirm(true)
                    }}
                    className="w-full py-2 rounded-xl font-medium bg-transparent border border-accent-red/30 text-accent-red/70 hover:bg-accent-red/10 hover:text-accent-red transition-all text-sm"
                  >
                    Nuclear Option: Delete Everything & Restart
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Modal */}
              <AnimatePresence>
                {showResetConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-quant-card border border-accent-red/30 rounded-2xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto"
                    >
                      <div className="text-center mb-4">
                        <div className="w-14 h-14 rounded-full bg-accent-red/20 flex items-center justify-center mx-auto mb-3">
                          <Trash2 size={28} className="text-accent-red" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Confirm Deletion</h3>
                        <p className="text-sm text-gray-400">
                          This action cannot be undone
                        </p>
                      </div>

                      {/* What will be deleted */}
                      <div className="bg-quant-surface rounded-xl p-3 mb-4">
                        <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                          Will be deleted:
                        </span>
                        <ul className="space-y-1">
                          {getDeleteImpact().impact.map((item, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-white">
                              <X size={12} className="text-accent-red" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Warnings */}
                      {getDeleteImpact().warnings.length > 0 && (
                        <div className="bg-accent-orange/10 border border-accent-orange/30 rounded-xl p-3 mb-4">
                          <span className="text-xs text-accent-orange uppercase tracking-wider block mb-2 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Cascade Effects
                          </span>
                          <ul className="space-y-1">
                            {getDeleteImpact().warnings.map((warning, i) => (
                              <li key={i} className="text-xs text-accent-orange">
                                • {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Mode indicator */}
                      <div className={`rounded-xl p-2 mb-4 text-xs flex items-center gap-2 ${
                        deleteOptions.keepLinkedData
                          ? 'bg-accent-cyan/10 text-accent-cyan'
                          : 'bg-accent-red/10 text-accent-red'
                      }`}>
                        {deleteOptions.keepLinkedData ? (
                          <>
                            <Link size={12} />
                            Safe mode: linked data will be preserved
                          </>
                        ) : (
                          <>
                            <Unlink size={12} />
                            Cascade mode: all linked data will be deleted
                          </>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          className="flex-1 py-3 rounded-xl bg-quant-surface text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        {deleteOptions.deletePrompts && deleteOptions.deleteEggs &&
                         deleteOptions.deleteSignals && deleteOptions.deleteLogs &&
                         deleteOptions.resetOnboarding && !deleteOptions.keepLinkedData ? (
                          <button
                            onClick={async () => {
                              setIsResetting(true)
                              await resetAllData()
                            }}
                            disabled={isResetting}
                            className="flex-1 py-3 rounded-xl bg-accent-red text-white font-medium hover:bg-accent-red/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isResetting ? (
                              <>
                                <RefreshCw size={16} className="animate-spin" />
                                Resetting...
                              </>
                            ) : (
                              'Reset Everything'
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={handleSelectiveDelete}
                            className="flex-1 py-3 rounded-xl bg-accent-red text-white font-medium hover:bg-accent-red/80 transition-colors"
                          >
                            Delete Selected
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Prompt Editor Modal */}
      <AnimatePresence>
        {showPromptEditor && (
          <PromptEditorModal
            prompt={editingPromptData}
            onClose={() => {
              setShowPromptEditor(false)
              setEditingPromptData(null)
            }}
            onSave={() => {
              setShowPromptEditor(false)
              setEditingPromptData(null)
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
