import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ErrorState } from '@/components/common/ErrorState';

// react-router's errorElement — catches render/loader/action errors for the
// route tree it's attached to (RootLayout's children) so one broken page
// doesn't take down the whole app shell.
export function RouteError() {
  const error = useRouteError();

  const description = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'This page ran into an unexpected error.';

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <ErrorState title="This page couldn't load" description={description} onRetry={() => window.location.reload()} />
    </div>
  );
}

export default RouteError;
