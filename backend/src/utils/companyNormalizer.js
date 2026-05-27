/**
 * Company name normalization helper
 * Prevents duplicates like HONDA, Honda, honda
 */

/**
 * Normalize a company name for deduplication
 * - trim whitespace
 * - collapse multiple spaces
 * - lowercase English characters
 * - preserve Arabic characters as-is
 */
function normalizeCompanyName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Display-friendly company name (preserves original casing but trims)
 */
function cleanCompanyName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

module.exports = { normalizeCompanyName, cleanCompanyName };
