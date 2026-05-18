import type { ScriptLanguage, SecurityRiskLevel, SecurityViolation, SecurityReviewResult } from './types.js';

interface PatternDef {
  pattern: RegExp;
  description: string;
  riskLevel: SecurityRiskLevel;
}

const LUA_PATTERNS: PatternDef[] = [
  { pattern: /\bos\.remove\b/, description: 'File removal via os.remove', riskLevel: 'high' },
  { pattern: /\bos\.execute\b/, description: 'Shell command execution via os.execute', riskLevel: 'critical' },
  { pattern: /\bio\.popen\b/, description: 'Shell command execution via io.popen', riskLevel: 'critical' },
  { pattern: /\brequire\s*\(\s*['"]os['"]\s*\)/, description: 'OS module import', riskLevel: 'high' },
  { pattern: /\bloadfile\b/, description: 'External file loading via loadfile', riskLevel: 'high' },
  { pattern: /\bdofile\b/, description: 'External file execution via dofile', riskLevel: 'critical' },
  { pattern: /\bload\s*\(/, description: 'Dynamic code execution via load()', riskLevel: 'high' },
  { pattern: /\bos\.exit\b/, description: 'Process termination via os.exit', riskLevel: 'medium' },
  { pattern: /\bio\.open\b/, description: 'File I/O via io.open', riskLevel: 'medium' },
];

const JAVASCRIPT_PATTERNS: PatternDef[] = [
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, description: 'Child process module import', riskLevel: 'critical' },
  { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, description: 'File system module import', riskLevel: 'high' },
  { pattern: /\bprocess\.exit\b/, description: 'Process termination via process.exit', riskLevel: 'medium' },
  { pattern: /\bfs\.unlink\b/, description: 'File deletion via fs.unlink', riskLevel: 'high' },
  { pattern: /\bfs\.rmdir\b/, description: 'Directory removal via fs.rmdir', riskLevel: 'high' },
  { pattern: /\bfs\.rm\b/, description: 'File/dir removal via fs.rm', riskLevel: 'high' },
  { pattern: /\beval\s*\(/, description: 'Dynamic code execution via eval()', riskLevel: 'critical' },
  { pattern: /\bFunction\s*\(/, description: 'Dynamic code execution via Function()', riskLevel: 'critical' },
];

const PYTHON_PATTERNS: PatternDef[] = [
  { pattern: /\bos\.remove\b/, description: 'File removal via os.remove', riskLevel: 'high' },
  { pattern: /\bos\.system\b/, description: 'Shell command execution via os.system', riskLevel: 'critical' },
  { pattern: /\bsubprocess\.call\b/, description: 'Subprocess execution via subprocess.call', riskLevel: 'critical' },
  { pattern: /\bsubprocess\.run\b/, description: 'Subprocess execution via subprocess.run', riskLevel: 'critical' },
  { pattern: /\bsubprocess\.Popen\b/, description: 'Subprocess execution via subprocess.Popen', riskLevel: 'critical' },
  { pattern: /\bshutil\.rmtree\b/, description: 'Directory tree removal via shutil.rmtree', riskLevel: 'critical' },
  { pattern: /\bos\.exec\b/, description: 'Process execution via os.exec', riskLevel: 'critical' },
  { pattern: /\bopen\s*\(.+\b['"]w['"]/, description: 'File write operation', riskLevel: 'medium' },
  { pattern: /\b__import__\b/, description: 'Dynamic module import via __import__', riskLevel: 'high' },
];

function getPatterns(language: ScriptLanguage): PatternDef[] {
  switch (language) {
    case 'lua': return LUA_PATTERNS;
    case 'javascript': return JAVASCRIPT_PATTERNS;
    case 'python': return PYTHON_PATTERNS;
  }
}

function escalateRisk(current: SecurityRiskLevel, next: SecurityRiskLevel): SecurityRiskLevel {
  const levels: SecurityRiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
  const ci = levels.indexOf(current);
  const ni = levels.indexOf(next);
  return ci >= ni ? current : next;
}

export function reviewScript(script: string, language: ScriptLanguage): SecurityReviewResult {
  const patterns = getPatterns(language);
  const violations: SecurityViolation[] = [];
  let riskLevel: SecurityRiskLevel = 'none';

  const lines = script.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (const def of patterns) {
      if (def.pattern.test(line)) {
        violations.push({
          pattern: def.pattern.source,
          line: lineIdx + 1,
          description: def.description,
          riskLevel: def.riskLevel,
        });
        riskLevel = escalateRisk(riskLevel, def.riskLevel);
      }
    }
  }

  return {
    passed: riskLevel === 'none' || riskLevel === 'low' || riskLevel === 'medium',
    riskLevel,
    violations,
  };
}
