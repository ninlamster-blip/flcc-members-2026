import type { BibleNode, SearchResult } from '@/types/bible';

function scoreMatch(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 0;
  if (t === q)            return 100;
  if (t.startsWith(q))    return 80;
  // word-boundary prefix
  if (t.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (t.includes(q))      return 40;
  return 0;
}

export function searchNodes(nodes: BibleNode[], query: string): SearchResult[] {
  const q = query.trim();
  if (q.length < 1) return [];

  const results: SearchResult[] = [];

  for (const node of nodes) {
    let best   = 0;
    let field: SearchResult['matchedField'] = 'label';

    const labelScore = scoreMatch(node.label, q) * 2.5;
    if (labelScore > best) { best = labelScore; field = 'label'; }

    const tagScore = (node.tags ?? [])
      .reduce((m, t) => Math.max(m, scoreMatch(t, q)), 0) * 1.8;
    if (tagScore > best) { best = tagScore; field = 'tags'; }

    const verseScore = node.verses
      .reduce((m, v) => Math.max(m, scoreMatch(v, q)), 0) * 1.2;
    if (verseScore > best) { best = verseScore; field = 'verses'; }

    const descScore = scoreMatch(node.description, q) * 0.6;
    if (descScore > best) { best = descScore; field = 'description'; }

    if (best > 0) results.push({ node, score: best, matchedField: field });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 12);
}

/** Returns a short snippet showing WHY a result matched. */
export function matchSnippet(result: SearchResult): string {
  const { node, matchedField } = result;
  switch (matchedField) {
    case 'label':       return node.label;
    case 'tags':        return (node.tags ?? []).join(' · ');
    case 'verses':      return node.verses.join('  ');
    case 'description': return node.description.slice(0, 80) + '…';
    default:            return '';
  }
}
