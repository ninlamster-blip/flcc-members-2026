import type { BibleNode, SearchResult } from '@/types/bible';

// ─── Simple fuzzy search engine ───────────────────────────────────────────────
// No external dependency — avoids bundle bloat for a static data set of ~100 nodes.

function score(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q)           return 100;
  if (t.startsWith(q))   return 80;
  if (t.includes(q))     return 60;
  // Character-by-character overlap
  let hits = 0;
  for (const ch of q) { if (t.includes(ch)) hits++; }
  return Math.round((hits / q.length) * 40);
}

/**
 * Search nodes by label, description, verses, and tags.
 * Returns results sorted by relevance score (descending).
 */
export function searchNodes(
  query:   string,
  nodes:   BibleNode[],
  limit = 10,
): SearchResult[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];

  for (const node of nodes) {
    let best = 0;
    let bestField: SearchResult['matchedField'] = 'label';

    const labelScore = score(query, node.label);
    if (labelScore > best) { best = labelScore; bestField = 'label'; }

    const descScore = score(query, node.description) * 0.7;
    if (descScore > best) { best = descScore; bestField = 'description'; }

    for (const v of node.verses) {
      const vs = score(query, v) * 0.9;
      if (vs > best) { best = vs; bestField = 'verses'; }
    }

    for (const tag of node.tags ?? []) {
      const ts = score(query, tag) * 0.85;
      if (ts > best) { best = ts; bestField = 'tags'; }
    }

    if (best > 20) {
      results.push({ node, score: best, matchedField: bestField });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
