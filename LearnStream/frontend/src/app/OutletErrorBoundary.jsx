import { Component } from 'react';
import { ErrorState } from '@/components/common/ErrorState';

// A plain render-error boundary for RootLayout's <Outlet/> (React error
// boundaries must be class components — there's no hook equivalent yet).
// Separate from RouteError.jsx: RouteError handles react-router
// loader/action/render errors thrown *during navigation*, this catches a
// render error thrown *after* a page has already mounted (e.g. a bug in a
// component deep in the tree), which react-router's errorElement does not.
export class OutletErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[OutletErrorBoundary]', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <ErrorState
            title="Something went wrong"
            description="This section couldn't render. You can try again."
            onRetry={this.handleRetry}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default OutletErrorBoundary;
