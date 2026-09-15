import { useQuery } from '@tanstack/react-query';
import { Users, GraduationCap, BookOpen, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompactNumber } from '@/lib/format';
import { getPlatformStats } from '../api.js';
import { reviewKeys } from '../queryKeys.js';

export function StatsStrip() {
  const query = useQuery({
    queryKey: reviewKeys.platformStats(),
    queryFn: getPlatformStats,
  });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) return null;

  const stats = query.data;
  const tiles = [
    { icon: Users, label: 'Students', value: formatCompactNumber(stats.studentCount) },
    { icon: GraduationCap, label: 'Instructors', value: formatCompactNumber(stats.instructorCount) },
    { icon: BookOpen, label: 'Courses', value: formatCompactNumber(stats.courseCount) },
    { icon: Star, label: 'Average rating', value: (Number(stats.averageRating) || 0).toFixed(1) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="stats-strip">
      {tiles.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex flex-col items-center gap-1 rounded-lg border py-4 text-center">
          <Icon className="text-primary" width={20} height={20} />
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default StatsStrip;
