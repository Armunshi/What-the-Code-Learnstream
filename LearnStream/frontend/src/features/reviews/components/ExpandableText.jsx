import { useState } from 'react';

const TRUNCATE_AT = 240;

// A review comment can run to 2000 chars (D7 max); this keeps a long one
// from dominating the grid until the reader opts in.
export function ExpandableText({ text }) {
  const [expanded, setExpanded] = useState(false);
  const value = text ?? '';

  if (value.length <= TRUNCATE_AT) {
    return <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>;
  }

  return (
    <p className="whitespace-pre-wrap text-sm text-foreground">
      {expanded ? value : `${value.slice(0, TRUNCATE_AT).trimEnd()}…`}{' '}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </p>
  );
}

export default ExpandableText;
