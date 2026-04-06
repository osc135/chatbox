/**
 * Plugin manifest sanitization.
 *
 * Tool descriptions are injected verbatim into the LLM system prompt. A
 * malicious third-party plugin could use its description field to attempt
 * prompt injection — instructing the LLM to ignore safety guidelines,
 * reveal student data, or override platform behavior.
 *
 * This module sanitizes all tool descriptions at *registration time*, before
 * they ever reach the LLM, so the attack surface is eliminated at the source.
 */

import type { PluginManifest } from './types'

/**
 * Patterns that indicate a prompt injection attempt in a tool description.
 * Legitimate tool descriptions are noun phrases describing capability, not
 * imperative commands directed at the model.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /you\s+are\s+now\s+(a\s+)?(?!helping)/i,
  /new\s+(system\s+)?instructions?\s*:/i,
  /\bsystem\s*:/i,
  /<\s*\/?\s*(system|instructions?|prompt|context)\s*>/i,
  /\[\s*(system|instructions?|override|admin)\s*\]/i,
  /always\s+respond\s+with/i,
  /reveal\s+(all\s+)?(student|user|personal|private)\s+(data|info|information)/i,
  /output\s+(all|every)\s+(student|user|account)/i,
  /print\s+(all\s+)?(student|user)\s+(data|records)/i,
  /exfiltrate/i,
  /\bDAN\b/,            // "Do Anything Now" jailbreak
  /jailbreak/i,
]

/**
 * Returns a sanitized copy of the description, or a safe fallback if injection
 * patterns are detected. Also strips HTML/XML tags, which have no place in
 * LLM tool descriptions.
 */
function sanitizeDescription(raw: string, pluginId: string, toolName: string): string {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(raw)) {
      console.warn(
        `[plugin-sdk] Rejected suspicious tool description in ${pluginId}::${toolName} — ` +
        `matched pattern ${pattern}. Replacing with safe fallback.`
      )
      return `Tool provided by the ${pluginId} plugin.`
    }
  }
  // Strip HTML/XML tags
  const stripped = raw.replace(/<[^>]*>/g, '').trim()
  // Collapse excessive whitespace
  return stripped.replace(/\s{3,}/g, '  ')
}

/**
 * Returns a deep copy of the manifest with all tool descriptions sanitized.
 * Call this on every manifest at registration time.
 */
export function sanitizePluginManifest(manifest: PluginManifest): PluginManifest {
  const sanitizedTools = Object.fromEntries(
    Object.entries(manifest.tools).map(([toolKey, toolDef]) => {
      // AI SDK tool shape: { description?: string, inputSchema, execute }
      const t = toolDef as Record<string, unknown>
      if (typeof t['description'] === 'string') {
        return [
          toolKey,
          { ...t, description: sanitizeDescription(t['description'], manifest.id, toolKey) },
        ]
      }
      return [toolKey, toolDef]
    })
  )
  return { ...manifest, tools: sanitizedTools }
}
