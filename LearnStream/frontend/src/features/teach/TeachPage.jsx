import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AuthContext from '@/contexts/AuthProvider';

const BENEFITS = [
  {
    title: 'Teach your way',
    body: 'Record video lectures, write articles, or build assignments — structure your course the way that fits your subject best.',
  },
  {
    title: 'Reach students worldwide',
    body: 'Publish once and let students discover your course through search, categories, and recommendations.',
  },
  {
    title: 'Get paid for your expertise',
    body: 'Set your own price and earn from every enrollment, with a purchase history you can track from your dashboard.',
  },
];

// The "Teach on LearnStream" info page (plan §0.4): a role switch isn't
// supported yet (a user has a single `role` enum, unique per email), so
// this is an explainer + a call to action, not a role-upgrade flow. A
// teacher who lands here directly gets pointed at their existing dashboard
// instead of a redundant signup CTA.
export function TeachPage() {
  const { auth, status } = useContext(AuthContext);
  const isTeacher = status === 'authenticated' && auth?.role === 'teacher';
  const isStudent = status === 'authenticated' && auth?.role === 'student';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12" data-testid="teach-page">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-3xl font-bold">Teach on LearnStream</h1>
        <p className="text-muted-foreground">
          Share what you know with students around the world. Create a course once, and earn from it for as long as
          students keep enrolling.
        </p>

        {isTeacher ? (
          <div className="mx-auto flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">You already have an instructor account.</p>
            <Button asChild>
              <Link to="/instructor/courses">Go to your instructor dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-2">
            {isStudent && (
              <p className="max-w-md text-sm text-muted-foreground">
                Instructor accounts are separate from student accounts today, so you&apos;ll need to sign up with a
                different email to teach.
              </p>
            )}
            <Button asChild size="lg" className="bg-brand-dark hover:bg-brand-dark/90">
              <Link to="/signup/teacher">Get started as an instructor</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <Card key={benefit.title}>
            <CardHeader>
              <CardTitle className="text-base">{benefit.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{benefit.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default TeachPage;
