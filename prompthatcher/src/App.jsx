import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Cloud } from 'lucide-react'
import useStore from './store/useStore'
import BottomNav from './components/BottomNav'
import Incubator from './pages/Incubator'
import Signals from './pages/Signals'
import Prompts from './pages/Prompts'
import Settings from './pages/Settings'
import PromptDetail from './pages/PromptDetail'
import NewPromptModal from './components/NewPromptModal'
import SignalDetailModal from './components/SignalDetailModal'
import PromptActionModal from './components/PromptActionModal'
import FAB from './components/FAB'
import Onboarding from './components/Onboarding'
import Login from './components/Login'
import EggIcon from './components/EggIcon'
import { supabase } from './lib/supabase'

function App() {
  // Auth state
  const user = useStore((state) => state.user)
  const isAuthenticated = useStore((state) => state.isAuthenticated)
  const authLoading = useStore((state) => state.authLoading)
  const setUser = useStore((state) => state.setUser)
  const setSession = useStore((state) => state.setSession)
  const setAuthLoading = useStore((state) => state.setAuthLoading)

  // Use individual selectors with safe defaults
  const activeTab = useStore((state) => state.activeTab) || 'prompts'
  const isNewPromptModalOpen = useStore((state) => state.isNewPromptModalOpen) || false
  const setNewPromptModalOpen = useStore((state) => state.setNewPromptModalOpen)
  const isPromptActionModalOpen = useStore((state) => state.isPromptActionModalOpen) || false
  const setPromptActionModalOpen = useStore((state) => state.setPromptActionModalOpen)
  const isSignalDetailOpen = useStore((state) => state.isSignalDetailOpen) || false
  const selectedPromptId = useStore((state) => state.selectedPromptId)
  const onboardingCompleted = useStore((state) => state.onboardingCompleted) || false
  const startPriceRefresh = useStore((state) => state.startPriceRefresh)
  const stopPriceRefresh = useStore((state) => state.stopPriceRefresh)
  const isCloudInitialized = useStore((state) => state.isCloudInitialized) || false
  const isInitializing = useStore((state) => state.isInitializing) || false
  const initializeFromCloud = useStore((state) => state.initializeFromCloud)

  // Listen for auth state changes
  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setAuthLoading])

  // Initialize data from Supabase cloud when authenticated
  useEffect(() => {
    if (isAuthenticated && !isCloudInitialized && !isInitializing) {
      initializeFromCloud()
    }
  }, [isAuthenticated, isCloudInitialized, isInitializing, initializeFromCloud])

  // Start price refresh interval when cloud data is loaded
  useEffect(() => {
    if (isAuthenticated && isCloudInitialized) {
      // Start automatic price refresh (every 15 minutes)
      startPriceRefresh()

      // Cleanup on unmount
      return () => {
        stopPriceRefresh()
      }
    }
  }, [isAuthenticated, isCloudInitialized, startPriceRefresh, stopPriceRefresh])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-quant-bg flex flex-col items-center justify-center">
        <Loader2 size={48} className="text-accent-cyan animate-spin" />
      </div>
    )
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />
  }

  // Show onboarding if not completed (after login)
  if (!onboardingCompleted) {
    return <Onboarding />
  }

  // Show loading screen while initializing from cloud
  if (!isCloudInitialized || isInitializing) {
    return (
      <div className="min-h-screen bg-quant-bg flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-24 h-24 mx-auto mb-6">
            <EggIcon size={96} status="incubating" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={32} className="text-accent-cyan animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Loading from Cloud</h2>
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
            <Cloud size={16} />
            Syncing your data...
          </p>
        </motion.div>
      </div>
    )
  }

  const renderPage = () => {
    if (selectedPromptId) {
      return <PromptDetail />
    }

    switch (activeTab) {
      case 'prompts':
        return <Prompts />
      case 'incubator':
        return <Incubator />
      case 'signals':
        return <Signals />
      case 'settings':
        return <Settings />
      default:
        return <Prompts />
    }
  }

  return (
    <div className="min-h-screen bg-quant-bg flex flex-col">
      {/* Main Content */}
      <main id="main-scroll-container" className="flex-1 overflow-y-auto hide-scrollbar pb-20 safe-area-top">
        <AnimatePresence mode="wait">
          {renderPage()}
        </AnimatePresence>
      </main>

      {/* FAB for adding new prompts - show on Prompts and Incubator pages */}
      {(activeTab === 'prompts' || activeTab === 'incubator') && !selectedPromptId && (
        <FAB onClick={() => activeTab === 'prompts' ? setPromptActionModalOpen(true) : setNewPromptModalOpen(true)} />
      )}

      {/* Bottom Navigation */}
      {!selectedPromptId && <BottomNav />}

      {/* Modals */}
      <AnimatePresence>
        {isPromptActionModalOpen && <PromptActionModal />}
        {isNewPromptModalOpen && <NewPromptModal />}
        {isSignalDetailOpen && <SignalDetailModal />}
      </AnimatePresence>
    </div>
  )
}

export default App
