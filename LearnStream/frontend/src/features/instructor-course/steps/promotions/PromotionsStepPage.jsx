import { ComingSoon } from '@/components/common/ComingSoon';

// C-FR-12 "Promotions" is Deferred (plan §4 requirements table) — a
// ComingSoon placeholder step, per this lane's task list.
export function PromotionsStepPage() {
  return (
    <div className="p-6">
      <ComingSoon title="Promotions" description="Coupons and promotional pricing aren't available yet." />
    </div>
  );
}

export default PromotionsStepPage;
