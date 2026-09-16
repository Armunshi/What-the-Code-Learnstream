import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Rendered when AuthProvider's status === 'guest' (plan §5.1's SiteHeader
// composition). Log in stays a plain link, matching the existing
// login/signup styling convention (components/Navbar1.jsx), not a new one.
export function AuthCtas() {
  return (
    <div className="flex items-center gap-3">
      <Link
        to="/login"
        data-testid="nav-login-link"
        className="hidden text-sm font-medium text-foreground hover:text-brand-dark sm:inline-flex"
      >
        Log in
      </Link>
      <Button asChild size="sm" data-testid="nav-signup-link" className="bg-brand-dark hover:bg-brand-dark/90">
        <Link to="/signup/student">Sign up</Link>
      </Button>
    </div>
  );
}

export default AuthCtas;
