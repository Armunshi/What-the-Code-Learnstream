import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { getPurchases } from '../api.js';
import { accountKeys } from '../queryKeys.js';

function formatPaise(priceInPaise, currency) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(
    (priceInPaise ?? 0) / 100
  );
}

export function PurchasesTab() {
  const { data: items, isLoading } = useQuery({ queryKey: accountKeys.purchases(), queryFn: getPurchases });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <EmptyState title="No purchases yet" description="Courses you buy will show up here." />;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="purchases-list">
      {items.map((item) => (
        <Card key={item.orderId + item.courseId} data-testid="purchase-row">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">
              <Link to={`/course/${item.courseId}`} className="hover:underline">
                {item.title}
              </Link>
            </CardTitle>
            <span className="text-sm font-medium">{formatPaise(item.priceInPaise, item.currency)}</span>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Purchased {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : '—'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default PurchasesTab;
