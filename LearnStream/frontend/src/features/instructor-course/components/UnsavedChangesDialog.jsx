import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIsAuthoringBusy } from '../stores/authoringStore';

// C-FR-21 "unsaved change detection": blocks in-app navigation (useBlocker,
// only works because app/router.jsx uses createBrowserRouter — a data
// router) while any autosave source is dirty or still saving, and warns on
// a tab close/refresh via beforeunload for the same condition. Mounted once
// per course by CourseAuthoringLayout, not per step, so it keeps working
// across step navigation within the same course.
export function UnsavedChangesDialog() {
  const isBusy = useIsAuthoringBusy();
  const blocker = useBlocker(isBusy);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isBusy) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isBusy]);

  if (blocker.state !== 'blocked') return null;

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            Your changes are still saving or haven&apos;t saved yet. If you leave now, they may be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset()}>Stay on this page</AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed()}>Leave anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default UnsavedChangesDialog;
