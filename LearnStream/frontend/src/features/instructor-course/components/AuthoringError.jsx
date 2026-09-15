import { ErrorState } from '@/components/common/ErrorState';

// The authoring shell's course-load failure state (plan §2.1, H-NFR-3.1) —
// a thin wrapper over the shared ErrorState so every step under
// CourseAuthoringLayout shows the same "couldn't load this course" panel
// instead of each one handling it differently.
export function AuthoringError({ onRetry }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <ErrorState
        title="Couldn't load this course"
        description="Something went wrong while loading the course you're editing."
        onRetry={onRetry}
      />
    </div>
  );
}

export default AuthoringError;
