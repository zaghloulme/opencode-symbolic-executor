/**
 * Stall detection: phrases that indicate the agent is stopping mid-task
 * and deferring to the user instead of continuing autonomously.
 */
export const STALL_PATTERNS = [
  "let me know if",
  "would you like",
  "should i",
  "shall i",
  "do you want me",
  "feel free",
  "i can help",
  "please let me know",
  "happy to help",
  "don't hesitate",
  "if you need",
  "just let me know",
  "would you like me",
  "if you'd like",
  "if you want",
  "i'm here to help",
  "i'd be happy",
  "at your convenience",
  "when you're ready",
] as const;

export function detectStallPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return STALL_PATTERNS.filter((p) => lower.includes(p));
}

export function buildContinuationPrompt(
  specs: { specId: string; title: string; pendingTasks: string[]; completedTasks: number; tasksCount: number }[],
  wasIdle: boolean,
): string {
  const specLines = specs
    .map((s) => {
      const remaining = s.tasksCount - s.completedTasks;
      const taskList = s.pendingTasks.length > 0 ? `\n  Pending: ${s.pendingTasks.join(", ")}` : "";
      return `- ${s.specId} (${s.title}): ${remaining} task(s) remaining${taskList}`;
    })
    .join("\n");

  const urgency = wasIdle
    ? "CRITICAL: You stopped with unfinished tasks. Resume immediately."
    : "You have unfinished SPEC tasks. Continue working through them without asking for permission.";

  return `\n## UNFINISHED WORK\n${urgency}\n\n${specLines}\n\nDo NOT ask "would you like me to continue?" or "shall I proceed?" — just do the next task.\n`;
}
