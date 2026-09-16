import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Shared placeholder for the account tabs the plan defers (security's
// active-sessions/2FA cards, subscriptions, payment-methods) — a real
// endpoint isn't wired up yet, so the tab still exists (nothing 404s) but
// says so plainly instead of rendering an empty page.
export function ComingSoon({ title, description }) {
  return (
    <Card data-testid="coming-soon">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description ?? 'Coming soon.'}</p>
      </CardContent>
    </Card>
  );
}

export default ComingSoon;
