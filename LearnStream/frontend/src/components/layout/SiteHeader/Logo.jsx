import { Link } from 'react-router-dom';

export function Logo({ onClick, className }) {
  return (
    <Link to="/" onClick={onClick} className={className ?? 'font-league text-xl font-bold'}>
      <span className="text-brand">Learn</span>Stream
    </Link>
  );
}

export default Logo;
