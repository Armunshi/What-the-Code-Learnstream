import { Link } from 'react-router-dom';
import { Star, Users, BookOpen } from 'lucide-react';
import { formatCount } from '@/lib/format';

export function InstructorBio({ instructor }) {
  if (!instructor?.name) return null;

  const stats = [
    { icon: Star, label: `${(instructor.avgRating ?? 0).toFixed(1)} Instructor rating` },
    { icon: Users, label: `${formatCount(instructor.totalStudents)} students` },
    { icon: BookOpen, label: `${formatCount(instructor.courseCount)} courses` },
  ];

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">Instructor</h2>
      <div className="mt-3 flex items-start gap-4">
        {instructor.avatar ? (
          <img src={instructor.avatar} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
        ) : null}
        <div>
          {instructor.username ? (
            <Link to={`/user/${instructor.username}`} className="text-base font-semibold text-primary hover:underline">
              {instructor.name}
            </Link>
          ) : (
            <p className="text-base font-semibold text-foreground">{instructor.name}</p>
          )}
          {instructor.headline ? <p className="text-sm text-muted-foreground">{instructor.headline}</p> : null}

          <ul className="mt-3 space-y-1.5">
            {stats.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-foreground">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          {instructor.bio ? <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{instructor.bio}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default InstructorBio;
