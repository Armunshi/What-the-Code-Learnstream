import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, setupQueryPersistence } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthProvider';
import { CartProvider } from '@/features/commerce';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { LoginPromptDialog } from '@/features/auth';

// The provider stack every route mounts under (plan §1.1):
// QueryClientProvider -> AuthProvider -> CartProvider -> TooltipProvider,
// plus the global <Toaster/> for the sonner-based error/success toasts and
// LoginPromptDialog so any useRequireAuth() caller anywhere in the tree can
// open it without each feature mounting its own copy.
export function AppProviders({ children }) {
  useEffect(() => {
    setupQueryPersistence();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            {children}
            <Toaster />
            <LoginPromptDialog />
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default AppProviders;
