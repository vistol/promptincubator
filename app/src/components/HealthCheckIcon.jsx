import { useMemo } from 'react'
import { motion } from 'framer-motion'

let hcIconCounter = 0

export default function HealthCheckIcon({
  size = 40,
  active = true,
  className = ''
}) {
  const { glowId, gradId } = useMemo(() => {
    const id = ++hcIconCounter
    return {
      glowId: `hcIconGlow${id}`,
      gradId: `hcIconGrad${id}`
    }
  }, [])

  const color1 = active ? '#10b981' : '#6b7280'
  const color2 = active ? '#00f0ff' : '#4b5563'

  return (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      overflow="visible"
      className={className}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="glow1"/>
          <feMerge>
            <feMergeNode in="glow1"/>
            <feMergeNode in="glow1"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Heart — filled glow behind */}
      <motion.path
        d="M 50 80
           C 50 80, 18 58, 18 38
           C 18 28, 26 20, 34 20
           C 40 20, 45 24, 50 30
           C 55 24, 60 20, 66 20
           C 74 20, 82 28, 82 38
           C 82 58, 50 80, 50 80 Z"
        fill={`url(#${gradId})`}
        opacity="0.2"
        filter={`url(#${glowId})`}
        initial={active ? { scale: 1 } : {}}
        animate={active ? { scale: [1, 1.06, 1] } : {}}
        transition={active ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ transformOrigin: '50px 50px' }}
      />

      {/* Heart — stroke outline with glow */}
      <motion.path
        d="M 50 80
           C 50 80, 18 58, 18 38
           C 18 28, 26 20, 34 20
           C 40 20, 45 24, 50 30
           C 55 24, 60 20, 66 20
           C 74 20, 82 28, 82 38
           C 82 58, 50 80, 50 80 Z"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="3"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        initial={active ? { scale: 1 } : {}}
        animate={active ? { scale: [1, 1.06, 1] } : {}}
        transition={active ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ transformOrigin: '50px 50px' }}
      />

      {/* Heartbeat / ECG line across the heart */}
      <motion.path
        d="M 24 48 L 36 48 L 40 36 L 50 62 L 54 38 L 58 48 L 76 48"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        initial={active ? { scale: 1 } : {}}
        animate={active ? { scale: [1, 1.06, 1] } : {}}
        transition={active ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ transformOrigin: '50px 50px' }}
      />
    </motion.svg>
  )
}
