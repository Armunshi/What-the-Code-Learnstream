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

// The autosave 409 branch (plan §2.4): "A 409 opens a dialog: 'reload
// latest' or 'overwrite'." Shared by every autosave-backed step form rather
// than each one building its own copy.
export function ConflictDialog({ open, onOverwrite, onReloadLatest }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This course was changed elsewhere</AlertDialogTitle>
          <AlertDialogDescription>
            It looks like this course was edited in another tab or by another save that finished first. You can keep
            your changes here and overwrite the other save, or reload the latest version and lose what you typed
            here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReloadLatest}>Reload latest</AlertDialogCancel>
          <AlertDialogAction onClick={onOverwrite}>Overwrite</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConflictDialog;
