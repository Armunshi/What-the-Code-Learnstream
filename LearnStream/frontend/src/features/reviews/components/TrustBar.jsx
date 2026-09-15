import { ShieldCheck, Award, RefreshCcw, Infinity as InfinityIcon } from 'lucide-react';

// Static trust markers — no data fetch. Same three guarantees most course
// platforms lead with; kept generic rather than tied to any one course.
const TRUST_ITEMS = [
  { icon: ShieldCheck, label: '30-day money-back guarantee' },
  { icon: InfinityIcon, label: 'Lifetime access' },
  { icon: Award, label: 'Certificate of completion' },
  { icon: RefreshCcw, label: 'Learn at your own pace' },
];

export function TrustBar() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
      data-testid="trust-bar"
    >
      {TRUST_ITEMS.map(({ icon: Icon, label }) => (
        <span key={label} className="inline-flex items-center gap-2">
          <Icon width={16} height={16} className="text-primary" />
          {label}
        </span>
      ))}
    </div>
  );
}

export default TrustBar;
