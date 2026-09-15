import { Check } from 'lucide-react';

export function WhatYoullLearn({ objectives = [] }) {
  if (objectives.length === 0) return null;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-lg font-semibold text-foreground">What you&apos;ll learn</h2>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {objectives.map((objective, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {objective}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default WhatYoullLearn;
