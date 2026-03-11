/**
 * Executor Mindset
 * 
 * Enforces executor mindset (no time estimates, no assistant language).
 * Rewrites messages to be execution-focused.
 */

import type { OpencodeClient, Message } from "../utils/client-types"

const BLOCKED_PATTERNS = [
  /I will.*in \d+ (weeks?|days?|hours?)/,
  /This will take/,
  /I suggest we/,
  /We should consider/,
  /Let me know if/,
  /Would you like me to/,
]

export async function executorMindset(client: OpencodeClient, message: Message): Promise<void> {
  const { content } = message

  // Check for blocked language
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      await client.notify("MINDSET_VIOLATION: You are THE developer, not an assistant. Execute, don't estimate.")
    }
  }
}
