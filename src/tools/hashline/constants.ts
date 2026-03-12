/**
 * Hashline edit tool constants
 * Based on oh-my-pi / oh-my-openagent implementation
 */

/**
 * 2-character hash alphabet for line content hashing
 * Selected for visual distinctness and low confusion
 */
export const HASHLINE_ALPHABET = 'ZPMQVRWSNKTXJBYH' as const

/**
 * Regex pattern for valid hashline references: LINE#ID format
 * Matches: 123#AB where 123 is line number, AB is 2-char hash
 */
export const HASHLINE_REF_PATTERN = /^(\d+)#([ZPMQVRWSNKTXJBYH]{2})$/

/**
 * Regex pattern for detecting hashline prefixes in text
 * Matches: ">>> 123#AB|" or "123#AB|" or "+123#AB|"
 */
export const HASHLINE_PREFIX_RE = /^\s*(?:>>>|[+-])?\s*\d+\s*#\s*[ZPMQVRWSNKTXJBYH]{2}\|/

/**
 * Stall detection patterns - phrases that indicate agent is stopping mid-task
 * From oh-my-openagent gpt-permission-continuation hook
 */
export const STALL_PATTERNS = [
  'let me know if',
  'would you like',
  'should i',
  'feel free',
  'i can help',
  'please let me know',
  'happy to help',
  'don\'t hesitate',
  'if you need',
  'just let me know',
  'let me know what',
  'would you like me',
  'shall i',
  'do you want me',
  'if you\'d like',
  'if you want',
  'i\'m here to help',
  'i\'d be happy',
  'feel free to',
  'don\'t hesitate',
  'at your convenience',
  'when you\'re ready',
  'let me know how',
] as const

/**
 * Mode detection keywords
 */
export const MODE_TRIGGERS = {
  plan: [
    /create a SPEC/i,
    /plan how to/i,
    /\bdesign\b/i,
    /i want to add/i,
    /add a feature/i,
    /architecture/i,
    /planning/i,
  ],
  build: [
    /proceed/i,
    /\bimplement\b/i,
    /\bbuild\b/i,
    /based on the SPEC/i,
    /per REQ-/i,
    /per TASK-/i,
    /SPEC-\d+.*implement/i,
    /SPEC-\d+.*build/i,
    /SPEC-\d+.*continue/i,
    /go ahead with/i,
    /continue with/i,
  ],
  chat: [
    /explain\b/i,
    /what is\b/i,
    /how do I/i,
    /fix this/i,
    /quick question/i,
    /general question/i,
    /\bwhy\b/i,
    /brainstorm/i,
  ],
} as const
