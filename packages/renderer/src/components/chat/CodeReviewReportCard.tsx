import { useState } from 'react';

export interface CodeReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'security' | 'performance' | 'correctness' | 'style' | 'best_practices';
  title: string;
  file: string;
  line?: number;
  code_snippet?: string;
  description: string;
  suggestion: string;
}

export interface CodeReviewReport {
  summary: string;
  score?: number;
  total_issues: number;
  severity_counts: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  issues: CodeReviewIssue[];
  positives: string[];
  scope: string;
}

interface CodeReviewReportCardProps {
  report: CodeReviewReport;
}

function SeverityIcon({ severity }: { severity: CodeReviewIssue['severity'] }) {
  switch (severity) {
    case 'critical':
      return <span className="text-red-500">🔴</span>;
    case 'major':
      return <span className="text-orange-500">🟡</span>;
    case 'minor':
      return <span className="text-yellow-500">🔵</span>;
    case 'info':
      return <span className="text-blue-400">ℹ️</span>;
  }
}

function SeverityBadge({ severity }: { severity: CodeReviewIssue['severity'] }) {
  const colors = {
    critical: 'bg-red-900/30 text-red-400 border-red-800',
    major: 'bg-orange-900/30 text-orange-400 border-orange-800',
    minor: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    info: 'bg-blue-900/30 text-blue-400 border-blue-800',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function IssueItem({ issue }: { issue: CodeReviewIssue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg mb-2 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 p-3 hover:bg-gray-800/50 transition-colors text-left"
      >
        <SeverityIcon severity={issue.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-cp-text truncate">{issue.title}</span>
            <SeverityBadge severity={issue.severity} />
          </div>
          <div className="text-xs text-gray-400">
            {issue.file}{issue.line ? `:L${issue.line}` : ''}
          </div>
        </div>
        <span className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-700 bg-gray-800/30">
          <div className="mt-2 space-y-2 text-sm">
            <div>
              <span className="text-gray-400 text-xs">Description:</span>
              <p className="text-cp-text mt-0.5">{issue.description}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Suggestion:</span>
              <p className="text-green-400 mt-0.5">{issue.suggestion}</p>
            </div>
            {issue.code_snippet && (
              <div className="mt-2">
                <span className="text-gray-400 text-xs">Code:</span>
                <pre className="mt-1 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                  {issue.code_snippet}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CodeReviewReportCard({ report }: CodeReviewReportCardProps) {
  const [showAllIssues, setShowAllIssues] = useState(false);

  const severityOrder: Array<CodeReviewIssue['severity']> = ['critical', 'major', 'minor', 'info'];
  const severityLabels = {
    critical: 'Critical',
    major: 'Major',
    minor: 'Minor',
    info: 'Info',
  };

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-800/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-cp-text flex items-center gap-2">
            <span className="text-lg">🔍</span>
            Code Review Report
          </h3>
          {report.score !== undefined && (
            <div className={`text-lg font-bold ${
              report.score >= 80 ? 'text-green-400' :
              report.score >= 60 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {report.score}/100
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-2">{report.summary}</p>
        <div className="text-xs text-gray-500">
          Scope: {report.scope}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-3 border-b border-gray-700 grid grid-cols-4 gap-2">
        {severityOrder.map((severity) => (
          <div
            key={severity}
            className={`text-center p-2 rounded ${
              severity === 'critical' ? 'bg-red-900/20' :
              severity === 'major' ? 'bg-orange-900/20' :
              severity === 'minor' ? 'bg-yellow-900/20' :
              'bg-blue-900/20'
            }`}
          >
            <div className="text-lg font-bold text-cp-text">
              {report.severity_counts[severity]}
            </div>
            <div className="text-xs text-gray-400">{severityLabels[severity]}</div>
          </div>
        ))}
      </div>

      {/* Issues by Severity */}
      <div className="max-h-96 overflow-y-auto px-4 py-3">
        {severityOrder.map((severity) => {
          const issues = report.issues.filter((i) => i.severity === severity);
          if (issues.length === 0) return null;

          return (
            <div key={severity} className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-2">
                <SeverityIcon severity={severity} />
                {severityLabels[severity]} ({issues.length})
              </h4>
              <div className="space-y-2">
                {(showAllIssues ? issues : issues.slice(0, 3)).map((issue, idx) => (
                  <IssueItem key={idx} issue={issue} />
                ))}
                {issues.length > 3 && !showAllIssues && (
                  <button
                    onClick={() => setShowAllIssues(true)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Show {issues.length - 3} more {severity} issue(s)...
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {report.issues.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">✅</div>
            <div>No issues found. Great job!</div>
          </div>
        )}
      </div>

      {/* Positives */}
      {report.positives.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-700 bg-green-900/10">
          <h4 className="text-xs font-semibold text-green-400 uppercase mb-2">
            ✅ Positives
          </h4>
          <ul className="space-y-1">
            {report.positives.map((positive, idx) => (
              <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{positive}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
