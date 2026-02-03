/**
 * @fileoverview Pipeline progress indicator component
 * @module trading/components/GenerationProgress
 */

import React from 'react';
import { stepMetadata } from '../pipeline/steps/index.js';

/**
 * Get step status from events
 * @param {string} stepKey - Step key
 * @param {Array} events - Pipeline events
 * @returns {'pending'|'in-progress'|'complete'|'error'} Step status
 */
function getStepStatus(stepKey, events) {
  const stepEvents = events.filter(e => e.step === stepKey);

  if (stepEvents.length === 0) return 'pending';

  if (stepEvents.some(e => e.level === 'error')) return 'error';

  if (stepEvents.some(e => e.message?.includes('Completed') || e.message?.includes('complete'))) {
    return 'complete';
  }

  return 'in-progress';
}

/**
 * Get step duration from events
 * @param {string} stepKey - Step key
 * @param {Array} events - Pipeline events
 * @returns {number|null} Duration in ms or null
 */
function getStepDuration(stepKey, events) {
  const completedEvent = events.find(
    e => e.step === stepKey && e.data?.duration
  );
  return completedEvent?.data?.duration || null;
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }) {
  const indicators = {
    pending: { symbol: '○', className: 'status-pending', label: 'Pending' },
    'in-progress': { symbol: '◐', className: 'status-progress', label: 'In Progress' },
    complete: { symbol: '●', className: 'status-complete', label: 'Complete' },
    error: { symbol: '✕', className: 'status-error', label: 'Error' }
  };

  const indicator = indicators[status] || indicators.pending;

  return (
    <span
      className={`status-indicator ${indicator.className}`}
      title={indicator.label}
      aria-label={indicator.label}
    >
      {indicator.symbol}
    </span>
  );
}

/**
 * Individual step component
 */
function StepItem({ step, status, duration, isLast }) {
  const meta = stepMetadata[step.key] || {
    label: step.key,
    icon: '⚙️',
    description: ''
  };

  return (
    <div className={`step-item step-${status}`}>
      <div className="step-connector">
        <div className={`connector-line ${isLast ? 'last' : ''}`} />
      </div>
      <div className="step-icon">{meta.icon}</div>
      <div className="step-content">
        <div className="step-header">
          <span className="step-label">{meta.label}</span>
          <StatusIndicator status={status} />
        </div>
        {status === 'in-progress' && (
          <div className="step-description">{meta.description}</div>
        )}
        {status === 'complete' && duration && (
          <div className="step-duration">{duration}ms</div>
        )}
        {status === 'error' && (
          <div className="step-error">Step failed</div>
        )}
      </div>
    </div>
  );
}

/**
 * Generation Progress Component
 * Shows real-time progress of the trade generation pipeline
 *
 * @param {Object} props - Component props
 * @param {Array} props.events - Pipeline events
 * @param {boolean} props.isComplete - Whether pipeline is complete
 * @param {string} props.error - Error message if failed
 * @param {boolean} props.compact - Compact display mode
 */
export function GenerationProgress({
  events = [],
  isComplete = false,
  error = null,
  compact = false
}) {
  const steps = [
    { key: 'fetchPrices' },
    { key: 'buildContext' },
    { key: 'generatePrompt' },
    { key: 'callAI' },
    { key: 'parseResponse' },
    { key: 'validateTrades' },
    { key: 'enrichGlassBox' }
  ];

  // Calculate overall progress
  const completedSteps = steps.filter(
    s => getStepStatus(s.key, events) === 'complete'
  ).length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  if (compact) {
    return (
      <div className="generation-progress-compact">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-text">
          {error ? (
            <span className="error-text">Error: {error}</span>
          ) : isComplete ? (
            <span className="complete-text">✓ Generation complete</span>
          ) : (
            <span>{completedSteps} of {steps.length} steps</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="generation-progress">
      <div className="progress-header">
        <h3>Generating Trades</h3>
        <span className="progress-percent">{progressPercent}%</span>
      </div>

      {error && (
        <div className="progress-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      <div className="steps-list">
        {steps.map((step, index) => (
          <StepItem
            key={step.key}
            step={step}
            status={getStepStatus(step.key, events)}
            duration={getStepDuration(step.key, events)}
            isLast={index === steps.length - 1}
          />
        ))}
      </div>

      {isComplete && !error && (
        <div className="progress-complete">
          <span className="complete-icon">✓</span>
          <span className="complete-message">
            Trade generation complete
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * CSS styles for the component (can be extracted to separate file)
 */
export const progressStyles = `
.generation-progress {
  padding: 16px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.progress-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.progress-percent {
  font-size: 14px;
  color: var(--text-secondary, #666);
}

.progress-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--error-bg, #fee);
  border-radius: 4px;
  margin-bottom: 16px;
  color: var(--error-color, #c00);
}

.steps-list {
  display: flex;
  flex-direction: column;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
}

.step-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
}

.connector-line {
  width: 2px;
  height: 100%;
  background: var(--border-color, #ddd);
}

.connector-line.last {
  display: none;
}

.step-icon {
  font-size: 20px;
  line-height: 1;
}

.step-content {
  flex: 1;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-label {
  font-weight: 500;
}

.status-indicator {
  font-size: 12px;
}

.status-pending { color: var(--text-tertiary, #999); }
.status-progress { color: var(--primary-color, #007bff); animation: pulse 1s infinite; }
.status-complete { color: var(--success-color, #28a745); }
.status-error { color: var(--error-color, #dc3545); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.step-description {
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-top: 2px;
}

.step-duration {
  font-size: 11px;
  color: var(--text-tertiary, #999);
}

.step-error {
  font-size: 12px;
  color: var(--error-color, #dc3545);
}

.step-in-progress .step-label {
  color: var(--primary-color, #007bff);
}

.step-complete .step-label {
  color: var(--success-color, #28a745);
}

.step-error .step-label {
  color: var(--error-color, #dc3545);
}

.progress-complete {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--success-bg, #d4edda);
  border-radius: 4px;
  margin-top: 16px;
  color: var(--success-color, #28a745);
}

/* Compact mode */
.generation-progress-compact {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-bar {
  height: 4px;
  background: var(--border-color, #ddd);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #007bff);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.progress-text .error-text {
  color: var(--error-color, #dc3545);
}

.progress-text .complete-text {
  color: var(--success-color, #28a745);
}
`;

export default GenerationProgress;
