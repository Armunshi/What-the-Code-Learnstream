import { formatCount } from '@/lib/format';

/** "1,234 results" — from the response's `total` (plan §6.3), never a
 * client-side `.length` (the page is only ever one page of results). */
export function ResultCount({ total }) {
  return (
    <p className="text-sm text-muted-foreground" data-testid="result-count">
      {formatCount(total)} {total === 1 ? 'result' : 'results'}
    </p>
  );
}

export default ResultCount;
