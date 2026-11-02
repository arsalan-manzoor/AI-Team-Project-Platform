// ============================================================
// ZYRA STRING UTILITIES
// ============================================================

/**
 * Normalizes a string by trimming whitespace and converting to uppercase.
 * Safely handles null, undefined, and non-string values.
 *
 * @param value - The value to normalize
 * @returns Normalized uppercase string, or empty string if input is falsy
 */
export function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim().toUpperCase();
}

/**
 * Normalizes a string by trimming whitespace (preserves case).
 * Safely handles null, undefined, and non-string values.
 *
 * @param value - The value to normalize
 * @returns Trimmed string, or empty string if input is falsy
 */
export function trimString(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Checks if a normalized string is included in an array of normalized strings.
 *
 * @param array - Array of strings to search
 * @param searchValue - Value to search for (will be normalized)
 * @returns True if found
 */
export function includesNormalized(array, searchValue) {
  if (!Array.isArray(array)) return false;
  const normalizedSearch = normalizeString(searchValue);
  return array.some((item) => normalizeString(item) === normalizedSearch);
}

/**
 * Maps an array to normalized uppercase strings.
 *
 * @param array - Array of values to normalize
 * @returns New array with normalized strings
 */
export function mapToNormalized(array) {
  if (!Array.isArray(array)) return [];
  return array.map((item) => normalizeString(item));
}

/**
 * Filters an array to only include items matching a normalized value.
 *
 * @param array - Array of objects/values to filter
 * @param getValue - Function to extract the comparison value from each item
 * @param searchValue - Value to match against (will be normalized)
 * @returns Filtered array
 */
export function filterByNormalized(array, getValue, searchValue) {
  if (!Array.isArray(array)) return [];
  const normalizedSearch = normalizeString(searchValue);
  return array.filter((item) => normalizeString(getValue(item)) === normalizedSearch);
}

/**
 * Finds the first item in an array matching a normalized value.
 *
 * @param array - Array to search
 * @param getValue - Function to extract the comparison value
 * @param searchValue - Value to match against (will be normalized)
 * @returns First matching item or undefined
 */
export function findByNormalized(array, getValue, searchValue) {
  if (!Array.isArray(array)) return undefined;
  const normalizedSearch = normalizeString(searchValue);
  return array.find((item) => normalizeString(getValue(item)) === normalizedSearch);
}

/**
 * Creates a safe getter for nested object properties.
 *
 * @param path - Dot-notation path (e.g., "user.profile.name")
 * @returns Function that safely retrieves the value or returns defaultValue
 */
export function createSafeGetter(path, defaultValue = "") {
  return (obj) => {
    if (!obj) return defaultValue;
    return path.split(".").reduce((current, key) => current?.[key], obj) ?? defaultValue;
  };
}

/**
 * Formats a string for display (capitalizes first letter of each word).
 *
 * @param value - String to format
 * @returns Formatted string
 */
export function formatDisplayString(value) {
  const str = trimString(value);
  if (!str) return "";
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Generates a storage key for workspace-specific role.
 *
 * @param workspaceId - The workspace ID
 * @returns Storage key string
 */
export function getWorkspaceRoleKey(workspaceId) {
  return `zyra_active_workspace_role_${normalizeString(workspaceId)}`;
}