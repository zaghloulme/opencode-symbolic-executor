/**
 * Hashline edit tool constants
 * Based on oh-my-pi / oh-my-openagent implementation
 */

/**
 * 2-character hash alphabet for line content hashing
 * Selected for visual distinctness and low confusion
 */
export const HASHLINE_ALPHABET = "ZPMQVRWSNKTXJBYH" as const;

/**
 * Regex pattern for valid hashline references: LINE#ID format
 * Matches: 123#AB where 123 is line number, AB is 2-char hash
 */
export const HASHLINE_REF_PATTERN = /^(\d+)#([ZPMQVRWSNKTXJBYH]{2})$/;

/**
 * Regex pattern for detecting hashline prefixes in text
 * Matches: ">>> 123#AB|" or "123#AB|" or "+123#AB|"
 */
export const HASHLINE_PREFIX_RE = /^\s*(?:>>>|[+-])?\s*\d+\s*#\s*[ZPMQVRWSNKTXJBYH]{2}\|/;
