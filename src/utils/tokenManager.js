/**
 * Token Management Utility
 * Estimates token counts for context budget management
 */

/**
 * Rough token estimation (1 token ≈ 4 characters for English text)
 * More accurate than character count, faster than tiktoken
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Check if text exceeds token limit
 */
export function exceedsTokenLimit(text, limit) {
  return estimateTokens(text) > limit;
}

/**
 * Truncate text to fit token limit while preserving readability
 */
export function truncateToTokenLimit(text, maxTokens) {
  const estimatedTokens = estimateTokens(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Keep first 70% and last 10% of content for context
  const maxChars = maxTokens * 4;
  const keepStart = Math.floor(maxChars * 0.7);
  const keepEnd = Math.floor(maxChars * 0.1);
  
  const truncated = 
    text.substring(0, keepStart) +
    '\n... [content truncated for context limit] ...\n' +
    text.substring(text.length - keepEnd);
  
  return truncated;
}

export default {
  estimateTokens,
  exceedsTokenLimit,
  truncateToTokenLimit,
};

