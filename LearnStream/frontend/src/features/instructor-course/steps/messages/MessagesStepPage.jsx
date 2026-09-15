import { ComingSoon } from '@/components/common/ComingSoon';

// C-FR-13 "Course messages" is Deferred (plan §4 requirements table) — a
// ComingSoon placeholder step, per this lane's task list.
export function MessagesStepPage() {
  return (
    <div className="p-6">
      <ComingSoon title="Course messages" description="Bulk messaging your students isn't available yet." />
    </div>
  );
}

export default MessagesStepPage;
