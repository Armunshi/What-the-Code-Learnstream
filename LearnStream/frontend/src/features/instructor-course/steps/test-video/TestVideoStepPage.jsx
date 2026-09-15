import { ComingSoon } from '@/components/common/ComingSoon';

// C-FR-1's "Setup & Test Video" is proposed Deferred (plan §4 requirements
// table) — this placeholder holds its place in the step registry so the
// sidebar's Create group isn't missing an entry a lane might reasonably
// expect to find.
export function TestVideoStepPage() {
  return (
    <div className="p-6">
      <ComingSoon
        title="Film & edit"
        description="Recording and testing your intro video isn't available yet — it's coming in a future update."
      />
    </div>
  );
}

export default TestVideoStepPage;
