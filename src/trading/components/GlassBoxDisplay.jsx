/**
 * @fileoverview Glass Box transparency display component
 * @module trading/components/GlassBoxDisplay
 */

import React, { useState } from 'react';

/**
 * Collapsible section component
 */
function CollapsibleSection({ title, icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`glassbox-section ${isOpen ? 'open' : ''}`}>
      <button
        className="section-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="section-icon">{icon}</span>
        <span className="section-title">{title}</span>
        <span className="section-toggle">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && <div className="section-content">{children}</div>}
    </div>
  );
}

/**
 * Reasoning display component
 */
function ReasoningSection({ reasoning }) {
  if (!reasoning) return null;

  const fields = [
    { key: 'whyAsset', label: 'Asset Selection', icon: '🎯' },
    { key: 'whyDirection', label: 'Trade Direction', icon: '↕️' },
    { key: 'whyEntry', label: 'Entry Point', icon: '📍' },
    { key: 'whyLevels', label: 'TP/SL Levels', icon: '📊' }
  ];

  return (
    <CollapsibleSection title="Reasoning" icon="🧠" defaultOpen>
      <div className="reasoning-grid">
        {fields.map(field => (
          <div key={field.key} className="reasoning-item">
            <div className="reasoning-label">
              <span>{field.icon}</span>
              <span>{field.label}</span>
            </div>
            <div className="reasoning-value">
              {reasoning[field.key] || 'Not provided'}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Criteria matched display component
 */
function CriteriaSection({ criteria }) {
  if (!criteria || criteria.length === 0) return null;

  const passed = criteria.filter(c => c.passed).length;
  const total = criteria.length;

  return (
    <CollapsibleSection title={`Criteria Matched (${passed}/${total})`} icon="✅">
      <div className="criteria-list">
        {criteria.map((criterion, index) => (
          <div
            key={index}
            className={`criteria-item ${criterion.passed ? 'passed' : 'failed'}`}
          >
            <span className="criteria-status">
              {criterion.passed ? '✓' : '✗'}
            </span>
            <span className="criteria-name">{criterion.criterion}</span>
            <span className="criteria-value">{criterion.value}</span>
            {criterion.threshold && (
              <span className="criteria-threshold">
                (threshold: {criterion.threshold})
              </span>
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Confidence factors display with visual bars
 */
function ConfidenceSection({ confidenceData }) {
  if (!confidenceData) return null;

  const { factors, totals } = confidenceData;

  if (!factors || factors.length === 0) return null;

  return (
    <CollapsibleSection title={`Confidence: ${totals?.score || 0}%`} icon="📈">
      <div className="confidence-factors">
        {factors.map((factor, index) => (
          <div key={index} className="factor-item">
            <div className="factor-header">
              <span className="factor-name">{factor.factor}</span>
              <span className="factor-score">{factor.score}/100</span>
            </div>
            <div className="factor-bar-container">
              <div
                className="factor-bar"
                style={{ width: `${factor.score}%` }}
              />
            </div>
            <div className="factor-meta">
              <span className="factor-weight">Weight: {factor.weight}%</span>
              <span className="factor-contribution">
                Contribution: {factor.contribution} pts
              </span>
            </div>
          </div>
        ))}

        <div className="confidence-total">
          <div className="total-label">Total Confidence Score</div>
          <div className="total-value">{totals?.score || 0}%</div>
          <div className="total-bar-container">
            <div
              className="total-bar"
              style={{ width: `${totals?.score || 0}%` }}
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

/**
 * Validation results display
 */
function ValidationSection({ validationData }) {
  if (!validationData) return null;

  const { results, summary } = validationData;

  if (!results || results.length === 0) return null;

  return (
    <CollapsibleSection
      title={`Validation (${summary?.passed || 0}/${summary?.total || 0})`}
      icon="🔍"
    >
      <div className="validation-list">
        {results.map((result, index) => (
          <div
            key={index}
            className={`validation-item ${result.passed ? 'passed' : 'failed'} severity-${result.severity || 'error'}`}
          >
            <span className="validation-status">
              {result.passed ? '✓' : result.severity === 'warning' ? '⚠' : '✗'}
            </span>
            <span className="validation-name">{result.name}</span>
            <span className="validation-message">{result.message}</span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Risk analysis display
 */
function RiskSection({ riskData }) {
  if (!riskData) return null;

  const { levels, ratios, position, assessment } = riskData;

  const riskColors = {
    low: '#28a745',
    moderate: '#ffc107',
    high: '#dc3545'
  };

  return (
    <CollapsibleSection title="Risk Analysis" icon="⚠️">
      <div className="risk-analysis">
        <div className="risk-level" style={{ borderColor: riskColors[assessment?.level] }}>
          <span className="risk-label">Risk Level:</span>
          <span
            className={`risk-value risk-${assessment?.level}`}
            style={{ color: riskColors[assessment?.level] }}
          >
            {assessment?.level?.toUpperCase()}
          </span>
        </div>

        <div className="risk-grid">
          <div className="risk-item">
            <span className="label">R:R Ratio</span>
            <span className="value">{ratios?.riskReward}:1</span>
          </div>
          <div className="risk-item">
            <span className="label">Risk %</span>
            <span className="value">{ratios?.riskPercent}%</span>
          </div>
          <div className="risk-item">
            <span className="label">Reward %</span>
            <span className="value">{ratios?.rewardPercent}%</span>
          </div>
          <div className="risk-item">
            <span className="label">Position Size</span>
            <span className="value">${position?.positionSize?.toLocaleString()}</span>
          </div>
          <div className="risk-item">
            <span className="label">Max Loss</span>
            <span className="value loss">${position?.maxLoss?.toLocaleString()}</span>
          </div>
          <div className="risk-item">
            <span className="label">Potential Profit</span>
            <span className="value profit">${position?.potentialProfit?.toLocaleString()}</span>
          </div>
        </div>

        {assessment?.warnings?.length > 0 && (
          <div className="risk-warnings">
            <div className="warnings-title">Warnings:</div>
            <ul>
              {assessment.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {assessment?.recommendation && (
          <div className="risk-recommendation">
            {assessment.recommendation}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Audit trail display
 */
function AuditSection({ auditData }) {
  if (!auditData) return null;

  const { pipeline, ai, executionId } = auditData;

  return (
    <CollapsibleSection title="Audit Trail" icon="📋">
      <div className="audit-trail">
        <div className="audit-item">
          <span className="label">Execution ID:</span>
          <code className="value">{executionId}</code>
        </div>

        <div className="audit-item">
          <span className="label">AI Provider:</span>
          <span className="value">{ai?.provider} ({ai?.model})</span>
        </div>

        <div className="audit-item">
          <span className="label">AI Latency:</span>
          <span className="value">{ai?.latency}ms</span>
        </div>

        <div className="audit-item">
          <span className="label">Tokens Used:</span>
          <span className="value">
            {ai?.tokensUsed?.inputTokens} in / {ai?.tokensUsed?.outputTokens} out
          </span>
        </div>

        <div className="audit-item">
          <span className="label">Total Duration:</span>
          <span className="value">{pipeline?.totalDuration}ms</span>
        </div>

        {pipeline?.steps && (
          <div className="pipeline-steps">
            <div className="steps-title">Pipeline Steps:</div>
            {pipeline.steps.map((step, i) => (
              <div key={i} className={`pipeline-step status-${step.status}`}>
                <span className="step-name">{step.step}</span>
                <span className="step-duration">{step.duration}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Main Glass Box Display Component
 *
 * @param {Object} props - Component props
 * @param {Object} props.glassBox - Glass Box data
 * @param {boolean} props.compact - Compact mode
 * @param {string[]} props.sections - Sections to display
 */
export function GlassBoxDisplay({
  glassBox,
  compact = false,
  sections = ['reasoning', 'criteriaMatched', 'confidenceFactors', 'validationResults', 'riskAnalysis', 'auditTrail']
}) {
  if (!glassBox) {
    return (
      <div className="glassbox-empty">
        No transparency data available
      </div>
    );
  }

  return (
    <div className={`glassbox-display ${compact ? 'compact' : ''}`}>
      <div className="glassbox-header">
        <span className="glassbox-icon">🔍</span>
        <span className="glassbox-title">Glass Box: Trade Transparency</span>
      </div>

      <div className="glassbox-content">
        {sections.includes('reasoning') && (
          <ReasoningSection reasoning={glassBox.reasoning} />
        )}

        {sections.includes('criteriaMatched') && (
          <CriteriaSection criteria={glassBox.criteriaMatched} />
        )}

        {sections.includes('confidenceFactors') && (
          <ConfidenceSection confidenceData={glassBox.confidenceFactors} />
        )}

        {sections.includes('validationResults') && (
          <ValidationSection validationData={glassBox.validationResults} />
        )}

        {sections.includes('riskAnalysis') && (
          <RiskSection riskData={glassBox.riskAnalysis} />
        )}

        {sections.includes('auditTrail') && (
          <AuditSection auditData={glassBox.auditTrail} />
        )}
      </div>

      <div className="glassbox-footer">
        Generated: {new Date(glassBox.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

/**
 * CSS styles for Glass Box Display
 */
export const glassBoxStyles = `
.glassbox-display {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
}

.glassbox-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-secondary, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.glassbox-title {
  font-weight: 600;
  font-size: 14px;
}

.glassbox-content {
  padding: 8px;
}

.glassbox-section {
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-secondary, #f9f9f9);
  border: none;
  cursor: pointer;
  text-align: left;
}

.section-header:hover {
  background: var(--bg-hover, #f0f0f0);
}

.section-title {
  flex: 1;
  font-weight: 500;
}

.section-toggle {
  font-size: 10px;
  color: var(--text-secondary, #666);
}

.section-content {
  padding: 12px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

/* Reasoning styles */
.reasoning-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reasoning-item {
  border-left: 3px solid var(--primary-color, #007bff);
  padding-left: 12px;
}

.reasoning-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-bottom: 4px;
}

.reasoning-value {
  font-size: 14px;
  line-height: 1.4;
}

/* Criteria styles */
.criteria-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.criteria-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  background: var(--bg-secondary, #f5f5f5);
}

.criteria-item.passed {
  border-left: 3px solid var(--success-color, #28a745);
}

.criteria-item.failed {
  border-left: 3px solid var(--error-color, #dc3545);
}

.criteria-status {
  font-weight: bold;
}

.criteria-item.passed .criteria-status { color: var(--success-color, #28a745); }
.criteria-item.failed .criteria-status { color: var(--error-color, #dc3545); }

.criteria-name {
  flex: 1;
  font-weight: 500;
}

.criteria-value {
  font-family: monospace;
}

.criteria-threshold {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

/* Confidence factors styles */
.confidence-factors {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.factor-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.factor-header {
  display: flex;
  justify-content: space-between;
}

.factor-name {
  font-weight: 500;
}

.factor-score {
  font-family: monospace;
}

.factor-bar-container,
.total-bar-container {
  height: 8px;
  background: var(--bg-secondary, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
}

.factor-bar {
  height: 100%;
  background: var(--primary-color, #007bff);
  transition: width 0.3s ease;
}

.total-bar {
  height: 100%;
  background: var(--success-color, #28a745);
}

.factor-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary, #666);
}

.confidence-total {
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.total-label {
  font-weight: 600;
  margin-bottom: 4px;
}

.total-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--success-color, #28a745);
  margin-bottom: 8px;
}

/* Risk analysis styles */
.risk-analysis {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.risk-level {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 4px;
  border: 2px solid;
  background: var(--bg-secondary, #f5f5f5);
}

.risk-value {
  font-weight: bold;
  font-size: 16px;
}

.risk-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.risk-item {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 4px;
}

.risk-item .label {
  font-size: 11px;
  color: var(--text-secondary, #666);
}

.risk-item .value {
  font-weight: 600;
}

.risk-item .value.loss { color: var(--error-color, #dc3545); }
.risk-item .value.profit { color: var(--success-color, #28a745); }

.risk-warnings {
  padding: 8px;
  background: var(--warning-bg, #fff3cd);
  border-radius: 4px;
}

.risk-warnings ul {
  margin: 4px 0 0 16px;
  padding: 0;
}

.risk-recommendation {
  padding: 8px;
  background: var(--info-bg, #d1ecf1);
  border-radius: 4px;
  font-style: italic;
}

/* Validation styles */
.validation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.validation-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
}

.validation-item.passed { background: var(--success-bg, #d4edda); }
.validation-item.failed.severity-error { background: var(--error-bg, #f8d7da); }
.validation-item.failed.severity-warning { background: var(--warning-bg, #fff3cd); }

.validation-name {
  font-weight: 500;
  min-width: 150px;
}

.validation-message {
  flex: 1;
  font-size: 13px;
}

/* Audit trail styles */
.audit-trail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.audit-item {
  display: flex;
  gap: 8px;
}

.audit-item .label {
  font-weight: 500;
  min-width: 120px;
}

.audit-item code {
  font-family: monospace;
  background: var(--bg-secondary, #f5f5f5);
  padding: 2px 6px;
  border-radius: 3px;
}

.pipeline-steps {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.steps-title {
  font-weight: 500;
  margin-bottom: 8px;
}

.pipeline-step {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 3px;
  margin-bottom: 4px;
}

.pipeline-step.status-success { background: var(--success-bg, #d4edda); }
.pipeline-step.status-error { background: var(--error-bg, #f8d7da); }

.glassbox-footer {
  padding: 8px 16px;
  background: var(--bg-secondary, #f5f5f5);
  border-top: 1px solid var(--border-color, #e0e0e0);
  font-size: 11px;
  color: var(--text-secondary, #666);
  text-align: right;
}

/* Compact mode */
.glassbox-display.compact .section-content {
  padding: 8px;
}

.glassbox-display.compact .reasoning-grid {
  gap: 8px;
}

.glassbox-display.compact .reasoning-value {
  font-size: 13px;
}
`;

export default GlassBoxDisplay;
