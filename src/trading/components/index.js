/**
 * @fileoverview Trading components exports
 * @module trading/components
 */

// Existing components
export { GenerationProgress, progressStyles } from './GenerationProgress.jsx';
export { GlassBoxDisplay, glassBoxStyles } from './GlassBoxDisplay.jsx';

// Event Log components
export {
  EventLog,
  EventRow,
  EVENT_TYPES,
  STEP_ICONS,
  STEP_NAMES,
  LEVEL_COLORS,
  formatEvent,
  getLevelColor,
  formatTimestamp
} from './EventLog/index.js';

// Incubator components
export {
  Incubator,
  EggCard
} from './Incubator/index.js';

/**
 * Combined styles for all trading components
 */
export const allStyles = `
/* Generation Progress Styles */
${typeof progressStyles !== 'undefined' ? progressStyles : ''}

/* Glass Box Display Styles */
${typeof glassBoxStyles !== 'undefined' ? glassBoxStyles : ''}
`;
