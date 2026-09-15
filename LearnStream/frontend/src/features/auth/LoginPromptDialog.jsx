import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLoginPromptStore } from './useRequireAuth.jsx';

// Opened by useRequireAuth() when a guest triggers a gated action. Mount
// this once near the app root (e.g. RootLayout) so it's available anywhere
// requireAuth() is called. Placeholder body only — AUTH wires up the actual
// login form and the post-login resume of the pending action in Wave 1.
export function LoginPromptDialog() {
  const isOpen = useLoginPromptStore((state) => state.isOpen);
  const close = useLoginPromptStore((state) => state.close);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log in to continue</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export default LoginPromptDialog;
