interface ScoreBreakdown {
  clarity: number;
  completeness: number;
  testability: number;
  security: number;
}

export function scorePlan(plan: string): ScoreBreakdown {
  return {
    clarity: scoreClarity(plan),
    completeness: scoreCompleteness(plan),
    testability: scoreTestability(plan),
    security: scoreSecurity(plan),
  };
}

export function calculateOverallScore(breakdown: ScoreBreakdown): number {
  return (
    breakdown.clarity * 0.3 + breakdown.completeness * 0.25 + breakdown.testability * 0.25 + breakdown.security * 0.2
  );
}

export function generateFeedback(breakdown: ScoreBreakdown, passed: boolean): string[] {
  const feedback: string[] = [];
  if (breakdown.clarity < 85) feedback.push("Clarity: Remove vague language (maybe, probably, should)");
  if (breakdown.completeness < 85)
    feedback.push("Completeness: Add missing sections (requirements, design, testing, verification)");
  if (breakdown.testability < 85)
    feedback.push("Testability: Make acceptance criteria measurable (use must/will, include numbers)");
  if (breakdown.security < 85) feedback.push("Security: Add security considerations (auth, validation, rate limiting)");
  if (passed) feedback.push("Plan meets threshold (≥85)");
  return feedback;
}

function scoreClarity(plan: string): number {
  const vaguePatterns = [/maybe/, /probably/, /try to/, /should/, /I think/];
  const vagueCount = vaguePatterns.filter((p) => p.test(plan)).length;
  return Math.max(0, 100 - vagueCount * 10);
}

function scoreCompleteness(plan: string): number {
  const required = ["requirements", "design", "testing", "verification"];
  const present = required.filter((r) => plan.toLowerCase().includes(r)).length;
  return (present / required.length) * 100;
}

function scoreTestability(plan: string): number {
  const measurablePatterns = [/must$/, /should$/, /will$/];
  const lines = plan.split("\n").filter((l) => l.trim().startsWith("-"));
  const measurable = lines.filter((l) => measurablePatterns.some((p) => p.test(l))).length;
  return lines.length > 0 ? (measurable / lines.length) * 100 : 0;
}

function scoreSecurity(plan: string): number {
  const securityMentions = [/auth/, /validation/, /sanitize/, /encrypt/, /rate limit/];
  const hasSecurity = securityMentions.some((p) => p.test(plan.toLowerCase()));
  return hasSecurity ? 100 : 50;
}
