import { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '@/contexts/AuthProvider';

// lg+ only (plan §5.1). A guest or student sees the "/teach" info page
// (role switching isn't supported yet — plan §0.4); a teacher sees a direct
// link to their own dashboard instead.
export function TeachLink() {
  const { auth, status } = useContext(AuthContext);
  const isTeacher = status === 'authenticated' && auth?.role === 'teacher';

  return (
    <Link
      to={isTeacher ? '/instructor/courses' : '/teach'}
      className="hidden whitespace-nowrap text-sm font-medium text-foreground hover:text-brand-dark lg:inline-flex lg:items-center"
    >
      {isTeacher ? 'Instructor dashboard' : 'Teach on LearnStream'}
    </Link>
  );
}

export default TeachLink;
