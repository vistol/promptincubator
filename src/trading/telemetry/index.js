/**
 * @fileoverview Pipeline telemetry and logging system
 * @module trading/telemetry
 */

/**
 * Telemetry class for tracking pipeline execution
 * Provides structured logging, timing, and audit trail capabilities
 */
export class PipelineTelemetry {
  /**
   * @param {string} executionId - Unique execution identifier
   */
  constructor(executionId) {
    this.executionId = executionId;
    this.events = [];
    this.startTime = Date.now();
    this.stepTimings = new Map();
    this.metadata = {};
  }

  /**
   * Log an event
   * @param {'info'|'warn'|'error'|'debug'} level - Log level
   * @param {string} step - Step name
   * @param {string} message - Event message
   * @param {Object} [data] - Additional data
   */
  log(level, step, message, data = {}) {
    const event = {
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      level,
      step,
      message,
      data: this._sanitizeData(data)
    };

    this.events.push(event);

    // Also emit to console in development
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${level.toUpperCase()}] [${step}]`;
      console[level === 'error' ? 'error' : 'log'](prefix, message, data);
    }

    return event;
  }

  /**
   * Log info level event
   */
  info(step, message, data) {
    return this.log('info', step, message, data);
  }

  /**
   * Log warning level event
   */
  warn(step, message, data) {
    return this.log('warn', step, message, data);
  }

  /**
   * Log error level event
   */
  error(step, message, data) {
    return this.log('error', step, message, data);
  }

  /**
   * Log debug level event
   */
  debug(step, message, data) {
    return this.log('debug', step, message, data);
  }

  /**
   * Start timing a step
   * @param {string} step - Step name
   */
  startStep(step) {
    this.stepTimings.set(step, {
      start: Date.now(),
      end: null,
      duration: null
    });
    this.info(step, `Starting step: ${step}`);
  }

  /**
   * End timing a step
   * @param {string} step - Step name
   * @param {'success'|'error'|'skipped'} status - Step status
   */
  endStep(step, status = 'success') {
    const timing = this.stepTimings.get(step);
    if (timing) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;
      timing.status = status;

      this.info(step, `Completed step: ${step}`, {
        duration: timing.duration,
        status
      });
    }
  }

  /**
   * Add metadata to the telemetry
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   */
  setMetadata(key, value) {
    this.metadata[key] = value;
  }

  /**
   * Get step timing information
   * @param {string} step - Step name
   * @returns {Object|null} Step timing or null
   */
  getStepTiming(step) {
    return this.stepTimings.get(step) || null;
  }

  /**
   * Get all step timings
   * @returns {Object} Map of step timings
   */
  getAllTimings() {
    const timings = {};
    for (const [step, timing] of this.stepTimings) {
      timings[step] = timing;
    }
    return timings;
  }

  /**
   * Get execution summary
   * @returns {Object} Summary object
   */
  getSummary() {
    const errors = this.events.filter(e => e.level === 'error');
    const warnings = this.events.filter(e => e.level === 'warn');

    return {
      executionId: this.executionId,
      startTime: this.startTime,
      totalDuration: Date.now() - this.startTime,
      stepsExecuted: [...this.stepTimings.keys()],
      stepTimings: this.getAllTimings(),
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.map(e => ({ step: e.step, message: e.message })),
      warnings: warnings.map(e => ({ step: e.step, message: e.message })),
      metadata: this.metadata
    };
  }

  /**
   * Get progress updates for UI display
   * @returns {Array} Array of progress updates
   */
  getProgressUpdates() {
    return this.events
      .filter(e => e.level === 'info')
      .map(e => ({
        step: e.step,
        message: e.message,
        elapsed: e.elapsed,
        timestamp: e.timestamp
      }));
  }

  /**
   * Get full event timeline
   * @returns {Array} All events
   */
  getTimeline() {
    return [...this.events];
  }

  /**
   * Get events for a specific step
   * @param {string} step - Step name
   * @returns {Array} Events for the step
   */
  getStepEvents(step) {
    return this.events.filter(e => e.step === step);
  }

  /**
   * Check if execution had errors
   * @returns {boolean} True if errors occurred
   */
  hasErrors() {
    return this.events.some(e => e.level === 'error');
  }

  /**
   * Export telemetry for persistence
   * @returns {Object} Exportable telemetry data
   */
  export() {
    return {
      executionId: this.executionId,
      startTime: this.startTime,
      endTime: Date.now(),
      events: this.events,
      stepTimings: this.getAllTimings(),
      metadata: this.metadata,
      summary: this.getSummary()
    };
  }

  /**
   * Sanitize data to prevent circular references and sensitive data
   * @private
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  _sanitizeData(data) {
    try {
      // Remove sensitive keys
      const sensitiveKeys = ['apiKey', 'password', 'secret', 'token', 'authorization'];
      const sanitized = { ...data };

      for (const key of sensitiveKeys) {
        if (key in sanitized) {
          sanitized[key] = '[REDACTED]';
        }
      }

      // Test for circular references
      JSON.stringify(sanitized);

      return sanitized;
    } catch (e) {
      return { _error: 'Data could not be serialized' };
    }
  }
}

/**
 * Create a new telemetry instance
 * @param {string} [executionId] - Optional execution ID
 * @returns {PipelineTelemetry} New telemetry instance
 */
export function createTelemetry(executionId) {
  const id = executionId || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return new PipelineTelemetry(id);
}

export default PipelineTelemetry;
