export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToTokens(
  text: string,
  maxTokens: number,
): { text: string; truncated: boolean } {
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) {
    return { text, truncated: false };
  }
  const charLimit = maxTokens * 4;
  return { text: text.slice(0, charLimit), truncated: true };
}
