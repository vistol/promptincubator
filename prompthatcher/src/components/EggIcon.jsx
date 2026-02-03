import { motion } from 'framer-motion'

export default function EggIcon({
  size = 48,
  status = 'incubating',
  winRate = 0,
  className = ''
}) {
  const getEggColor = () => {
    if (status === 'expired') {
      return '#f97316' // orange for expired
    }
    if (status === 'hatched') {
      return winRate >= 50 ? '#10b981' : '#ef4444'
    }
    return '#00f0ff'
  }

  const getGlowIntensity = () => {
    if (status === 'incubating') return 0.4
    if (status === 'expired') return 0.35
    if (status === 'hatched' && winRate >= 50) return 0.6
    return 0.3
  }

  // Hatched egg - broken shell with chick/star emerging
  if (status === 'hatched') {
    const color = getEggColor()
    return (
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={className}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <defs>
          <linearGradient id="hatchedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
          </linearGradient>
          <filter id="glowHatched">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Glow */}
        <ellipse
          cx="50"
          cy="70"
          rx="28"
          ry="20"
          fill={color}
          opacity={getGlowIntensity()}
          filter="url(#glowHatched)"
        />

        {/* Bottom shell (broken) */}
        <motion.path
          d="M 22 65
             Q 22 90, 50 90
             Q 78 90, 78 65
             L 72 55
             L 65 62
             L 55 50
             L 45 60
             L 35 52
             L 28 58
             Z"
          fill="url(#hatchedGrad)"
          initial={{ scale: 0.8, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        />

        {/* Inner shadow on shell */}
        <path
          d="M 30 65
             Q 30 82, 50 82
             Q 70 82, 70 65
             L 65 58
             L 55 55
             L 45 60
             L 35 55
             Z"
          fill="#0a0e17"
          opacity="0.3"
        />

        {/* Star/sparkle emerging (success indicator) */}
        <motion.g
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
        >
          {/* Main star */}
          <motion.path
            d="M 50 15 L 53 28 L 65 28 L 55 36 L 59 50 L 50 42 L 41 50 L 45 36 L 35 28 L 47 28 Z"
            fill={color}
            initial={{ rotate: -20 }}
            animate={{ rotate: 0 }}
            transition={{ delay: 0.4 }}
          />
          {/* Sparkles */}
          <motion.circle cx="35" cy="22" r="2" fill={color} opacity="0.8"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 }} />
          <motion.circle cx="65" cy="20" r="2.5" fill={color} opacity="0.8"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 }} />
          <motion.circle cx="70" cy="35" r="1.5" fill={color} opacity="0.6"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 }} />
        </motion.g>
      </motion.svg>
    )
  }

  // Expired egg - whole egg with clock overlay
  if (status === 'expired') {
    const color = getEggColor()
    return (
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={className}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <defs>
          <linearGradient id="expiredGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#6b7280', stopOpacity: 0.6 }} />
          </linearGradient>
          <filter id="glowExpired">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Dimmed egg */}
        <ellipse
          cx="50"
          cy="55"
          rx="28"
          ry="36"
          fill="url(#expiredGrad)"
          opacity="0.5"
        />

        {/* Clock overlay */}
        <motion.g filter="url(#glowExpired)">
          <motion.circle
            cx="50"
            cy="55"
            r="18"
            stroke={color}
            strokeWidth="3"
            fill="#0a0e17"
            fillOpacity="0.8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          />
          {/* Clock face marks */}
          <line x1="50" y1="40" x2="50" y2="43" stroke={color} strokeWidth="2" />
          <line x1="50" y1="67" x2="50" y2="70" stroke={color} strokeWidth="2" />
          <line x1="35" y1="55" x2="38" y2="55" stroke={color} strokeWidth="2" />
          <line x1="62" y1="55" x2="65" y2="55" stroke={color} strokeWidth="2" />
          {/* Clock hands */}
          <motion.line
            x1="50" y1="55" x2="50" y2="45"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ rotate: -90, originX: '50px', originY: '55px' }}
            animate={{ rotate: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          />
          <motion.line
            x1="50" y1="55" x2="58" y2="55"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ rotate: -180, originX: '50px', originY: '55px' }}
            animate={{ rotate: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          />
          {/* Center dot */}
          <circle cx="50" cy="55" r="2" fill={color} />
        </motion.g>
      </motion.svg>
    )
  }

  // Incubating egg - whole egg with glow animation
  return (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`egg-incubating ${className}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <defs>
        <linearGradient id="eggGradIncubating" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: getEggColor(), stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="glowIncubating">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow */}
      <ellipse
        cx="50"
        cy="55"
        rx="32"
        ry="40"
        fill={getEggColor()}
        opacity={getGlowIntensity()}
        filter="url(#glowIncubating)"
      />

      {/* Main egg */}
      <ellipse
        cx="50"
        cy="55"
        rx="28"
        ry="36"
        fill="url(#eggGradIncubating)"
      />

      {/* Inner shadow */}
      <ellipse
        cx="50"
        cy="55"
        rx="23"
        ry="31"
        fill="#0a0e17"
        opacity="0.25"
      />

      {/* Highlight */}
      <ellipse
        cx="42"
        cy="42"
        rx="7"
        ry="9"
        fill="white"
        opacity="0.35"
      />

      {/* Pulse ring for active incubation */}
      <motion.ellipse
        cx="50"
        cy="55"
        rx="28"
        ry="36"
        fill="none"
        stroke={getEggColor()}
        strokeWidth="2"
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: 1.2, opacity: 0 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
      />
    </motion.svg>
  )
}
