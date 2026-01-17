import { normalizeDomain } from './domain.js';

type AnyBlock = Record<string, unknown>;

/**
 * Normalize a single block's domain. All other fields are passed through untouched.
 * Callers can provide a warn function (dev-only) to surface missing/invalid domains.
 */
export function normalizeBlockDomain<T extends AnyBlock>(
  block: T,
  warn?: (msg: string) => void
): T & { domain: ReturnType<typeof normalizeDomain> } {
  const nextDomain = normalizeDomain((block as AnyBlock).domain);
  if (warn && (!block || block.domain !== nextDomain)) {
    warn(`[domain] Block missing/invalid domain -> defaulted to "${nextDomain}". id=${String(block?.id ?? 'unknown')}`);
  }

  return {
    ...block,
    domain: nextDomain
  } as T & { domain: ReturnType<typeof normalizeDomain> };
}

export function normalizeBlocksDomain<T extends AnyBlock>(
  blocks: T[] = [],
  warn?: (msg: string) => void
) {
  return blocks.map((b) => normalizeBlockDomain(b, warn));
}
