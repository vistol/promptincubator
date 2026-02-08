// Strategy Importer — fetches external trading strategies and market data
// Sources: GitHub (Freqtrade repos), Binance Futures (funding, OI, long/short)

import { callLLMForText } from './aiService'

// ─── GitHub: Freqtrade Strategy Scraper ──────────────────────────

const GITHUB_API = 'https://api.github.com'
const GITHUB_RAW = 'https://raw.githubusercontent.com'

/**
 * Search GitHub for Freqtrade strategy repositories
 * No auth needed (60 req/h rate limit)
 * @param {number} maxRepos - Max repos to fetch (default 3 to stay within limits)
 * @returns {Array} [{name, fullName, description, stars, url}]
 */
export const searchFreqtradeRepos = async (maxRepos = 3) => {
  try {
    const response = await fetch(
      `${GITHUB_API}/search/repositories?q=freqtrade+strategy+language:python&sort=stars&order=desc&per_page=${maxRepos}`,
      {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      }
    )

    if (!response.ok) {
      if (response.status === 403) throw new Error('GitHub API rate limit exceeded. Wait a few minutes.')
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    return (data.items || []).map(repo => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || 'No description',
      stars: repo.stargazers_count,
      url: repo.html_url,
      defaultBranch: repo.default_branch || 'main'
    }))
  } catch (error) {
    console.error('GitHub search failed:', error)
    throw error
  }
}

/**
 * Get Python strategy files from a repo
 * Looks for .py files in common locations
 * @param {Object} repo - {fullName, defaultBranch}
 * @returns {Array} [{name, path, downloadUrl}]
 */
export const getStrategyFiles = async (repo) => {
  const searchPaths = [
    '', // root
    'user_data/strategies',
    'strategies',
    'freqtrade/strategies',
  ]

  for (const path of searchPaths) {
    try {
      const url = `${GITHUB_API}/repos/${repo.fullName}/contents/${path}`
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      })

      if (!response.ok) continue

      const files = await response.json()
      if (!Array.isArray(files)) continue

      const strategyFiles = files
        .filter(f => f.name.endsWith('.py') && f.name !== '__init__.py' && f.name !== 'setup.py')
        .slice(0, 3) // Max 3 files per repo
        .map(f => ({
          name: f.name.replace('.py', ''),
          path: f.path,
          downloadUrl: f.download_url || `${GITHUB_RAW}/${repo.fullName}/${repo.defaultBranch}/${f.path}`
        }))

      if (strategyFiles.length > 0) return strategyFiles
    } catch {
      continue
    }
  }

  return []
}

/**
 * Download raw strategy file content
 * @param {string} url - Raw file URL
 * @returns {string} File content (Python code)
 */
export const downloadStrategyFile = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`)
  const text = await response.text()
  // Limit to first 4000 chars to fit in LLM context
  return text.slice(0, 4000)
}

/**
 * Full pipeline: search repos → get files → download → convert to prompts
 * @param {Object} settings - App settings with apiKeys
 * @param {Function} onLog - Log callback
 * @returns {Array} Array of new prompt objects ready to add to store
 */
export const fetchFreqtradeStrategies = async (settings, onLog = () => {}) => {
  const newPrompts = []

  onLog('Buscando estrategias en GitHub...', 'info')
  const repos = await searchFreqtradeRepos(3)

  if (repos.length === 0) {
    onLog('No se encontraron repos de Freqtrade', 'warning')
    return []
  }

  onLog(`Encontrados ${repos.length} repos: ${repos.map(r => r.name).join(', ')}`, 'success')

  for (const repo of repos) {
    try {
      onLog(`Explorando ${repo.fullName}...`, 'info')
      const files = await getStrategyFiles(repo)

      if (files.length === 0) {
        onLog(`${repo.name}: sin archivos de estrategia`, 'warning')
        continue
      }

      // Only take the first strategy file from each repo
      const file = files[0]
      onLog(`Descargando ${file.name} de ${repo.name}...`, 'info')

      const code = await downloadStrategyFile(file.downloadUrl)

      // Convert to prompt using LLM
      onLog(`Convirtiendo ${file.name} a prompt de trading...`, 'info')
      const promptContent = await convertStrategyToPrompt(code, file.name, repo.name, settings)

      if (promptContent) {
        newPrompts.push({
          id: crypto.randomUUID(),
          name: `${file.name} (${repo.name})`,
          content: promptContent,
          status: 'active',
          capital: 1000,
          leverage: 5,
          targetPct: 10,
          executionTime: 'target',
          minIpe: 70,
          aiModel: 'groq', // Use cheapest model by default
          numResults: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'github-import',
          sourceRepo: repo.fullName
        })
        onLog(`Importada: ${file.name} de ${repo.name}`, 'success')
      }

      // Rate limit: wait between repos
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      onLog(`Error en ${repo.name}: ${err.message}`, 'error')
    }
  }

  return newPrompts
}

/**
 * Convert Python strategy code to a trading prompt using LLM
 * @param {string} code - Python strategy source code
 * @param {string} strategyName - Strategy file name
 * @param {string} repoName - Repository name
 * @param {Object} settings - App settings
 * @returns {string} Prompt content for the app
 */
const convertStrategyToPrompt = async (code, strategyName, repoName, settings) => {
  const conversionPrompt = `You are an expert at converting algorithmic trading strategies to natural language trading prompts.

I have this Freqtrade Python strategy code from the "${repoName}" repository:

\`\`\`python
${code}
\`\`\`

Convert this into a concise trading prompt in Spanish that describes:
1. The main trading logic (what indicators and conditions it uses)
2. Entry criteria (when to open LONG or SHORT)
3. Exit criteria (take profit and stop loss logic)
4. Any special conditions or filters

Write it as a trading strategy prompt that an AI could follow to generate trade signals.
Format: A clear, actionable Spanish paragraph (200-400 words max).
Do NOT include any code. Only natural language.
Start directly with the strategy description, no headers or titles.`

  try {
    const result = await callLLMForText(conversionPrompt, settings)
    return result
  } catch (error) {
    console.error('Strategy conversion failed:', error)
    return null
  }
}

// ─── Binance Futures: Market Data ────────────────────────────────

const BINANCE_FAPI = 'https://fapi.binance.com'
const BINANCE_FUTURES_DATA = 'https://fapi.binance.com/futures/data'

/**
 * Fetch funding rate for a symbol
 * @param {string} symbol - e.g. 'BTCUSDT'
 * @returns {Object} {symbol, fundingRate, fundingTime, nextFundingTime}
 */
export const fetchFundingRate = async (symbol = 'BTCUSDT') => {
  try {
    const response = await fetch(`${BINANCE_FAPI}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`)
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`)
    const data = await response.json()
    if (!data || data.length === 0) return null

    return {
      symbol,
      fundingRate: parseFloat(data[0].fundingRate),
      fundingRatePercent: (parseFloat(data[0].fundingRate) * 100).toFixed(4),
      fundingTime: data[0].fundingTime
    }
  } catch (error) {
    console.error(`Funding rate fetch failed for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch open interest
 * @param {string} symbol - e.g. 'BTCUSDT'
 * @returns {Object} {symbol, openInterest, notionalValue}
 */
export const fetchOpenInterest = async (symbol = 'BTCUSDT') => {
  try {
    const response = await fetch(`${BINANCE_FAPI}/fapi/v1/openInterest?symbol=${symbol}`)
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`)
    const data = await response.json()

    return {
      symbol,
      openInterest: parseFloat(data.openInterest),
      notionalValue: parseFloat(data.openInterest) // Will be multiplied by price later
    }
  } catch (error) {
    console.error(`Open interest fetch failed for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch top trader long/short ratio
 * @param {string} symbol - e.g. 'BTCUSDT'
 * @returns {Object} {symbol, longShortRatio, longAccount, shortAccount}
 */
export const fetchLongShortRatio = async (symbol = 'BTCUSDT') => {
  try {
    const response = await fetch(
      `${BINANCE_FUTURES_DATA}/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=1`
    )
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`)
    const data = await response.json()
    if (!data || data.length === 0) return null

    return {
      symbol,
      longShortRatio: parseFloat(data[0].longShortRatio),
      longAccount: parseFloat(data[0].longAccount),
      shortAccount: parseFloat(data[0].shortAccount),
      timestamp: data[0].timestamp
    }
  } catch (error) {
    console.error(`Long/short ratio fetch failed for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch all Binance Futures data for a symbol
 * @param {string} symbol - e.g. 'BTCUSDT'
 * @returns {Object} Combined market data
 */
export const fetchBinanceFuturesData = async (symbol = 'BTCUSDT') => {
  const [funding, oi, longShort] = await Promise.all([
    fetchFundingRate(symbol),
    fetchOpenInterest(symbol),
    fetchLongShortRatio(symbol)
  ])

  return {
    symbol,
    funding,
    openInterest: oi,
    longShort,
    timestamp: Date.now()
  }
}

/**
 * Fetch market data for multiple symbols
 * @param {Array} symbols - e.g. ['BTCUSDT', 'ETHUSDT']
 * @param {Function} onLog - Log callback
 * @returns {Object} {BTCUSDT: {...}, ETHUSDT: {...}}
 */
export const fetchAllFuturesData = async (symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], onLog = () => {}) => {
  onLog(`Obteniendo datos de Binance Futures (${symbols.join(', ')})...`, 'info')

  const results = {}
  for (const symbol of symbols) {
    try {
      results[symbol] = await fetchBinanceFuturesData(symbol)
      onLog(`${symbol}: funding ${results[symbol].funding?.fundingRatePercent || '?'}%, OI: ${results[symbol].openInterest?.openInterest?.toFixed(0) || '?'}, L/S: ${results[symbol].longShort?.longShortRatio?.toFixed(2) || '?'}`, 'success')
    } catch (err) {
      onLog(`${symbol}: Error — ${err.message}`, 'error')
    }
  }

  return results
}

/**
 * Format market data into a text summary for LLM consumption
 * @param {Object} futuresData - Output from fetchAllFuturesData
 * @returns {string} Human-readable market data summary
 */
export const formatMarketDataForLLM = (futuresData) => {
  if (!futuresData || Object.keys(futuresData).length === 0) return 'No market data available.'

  const lines = ['Current Binance Futures Market Data:']

  for (const [symbol, data] of Object.entries(futuresData)) {
    const parts = [`${symbol}:`]

    if (data.funding) {
      const rate = data.funding.fundingRatePercent
      parts.push(`Funding Rate ${rate}%`)
      if (parseFloat(rate) > 0.05) parts.push('(longs paying shorts, bullish crowding)')
      else if (parseFloat(rate) < -0.01) parts.push('(shorts paying longs, bearish crowding)')
    }

    if (data.openInterest) {
      parts.push(`Open Interest: ${data.openInterest.openInterest.toLocaleString()} contracts`)
    }

    if (data.longShort) {
      const ratio = data.longShort.longShortRatio
      parts.push(`L/S Ratio: ${ratio.toFixed(2)}`)
      if (ratio > 2.5) parts.push('(extremely bullish sentiment)')
      else if (ratio > 1.5) parts.push('(bullish sentiment)')
      else if (ratio < 0.7) parts.push('(bearish sentiment)')
    }

    lines.push(parts.join(' | '))
  }

  return lines.join('\n')
}
