/**
 * initiativeAliasDerivation.js
 *
 * Pure utility for deriving searchable aliases from initiative names.
 * No dependencies on the loader, registry, or any other modules — importable
 * from both production code and test fixtures without circular-dependency risk.
 *
 * Exported here as the single, authoritative implementation. Imported by:
 *   - initiativeRegistryLoader.js (production loader)
 *   - tests/fixtures/initiativeRegistryTestHelper.js (test fixtures)
 *   - tests/* (any test that needs alias matching logic)
 *
 * If this function changes, the change applies everywhere automatically.
 * No manual sync required; no duplication risk.
 */

/**
 * Derives searchable aliases from an initiative name.
 * Generates both the name itself and word-level variants for flexible matching.
 *
 * Example: "The Jericho System" → ["the jericho system", "jericho", "jericho system", "system"]
 *
 * @param {string} name - Initiative name to derive aliases from
 * @returns {Array<string>} Array of alias strings (lowercase, normalized)
 */
export function deriveAliasesFromName(name) {
  const normalized = name.toLowerCase().trim();
  const aliases = new Set();

  // Add the full name
  aliases.add(normalized);

  // Add individual significant words (exclude articles like "the", "a")
  const words = normalized
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'from', 'with'].includes(w));
  words.forEach((word) => aliases.add(word));

  // Add 2-word combinations for common patterns
  for (let i = 0; i < words.length - 1; i++) {
    aliases.add(`${words[i]} ${words[i + 1]}`);
  }

  return Array.from(aliases);
}

export default deriveAliasesFromName;
