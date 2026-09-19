import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import AuthContext from '@/contexts/AuthProvider';
import { TeachLink } from './TeachLink.jsx';

function renderWithAuth({ status, auth }) {
  return render(
    <AuthContext.Provider value={{ status, auth, setAuth: () => {} }}>
      <MemoryRouter>
        <TeachLink />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('TeachLink', () => {
  it('links a guest to the /teach info page', () => {
    renderWithAuth({ status: 'guest', auth: {} });
    const link = screen.getByRole('link', { name: 'Teach on LearnStream' });
    expect(link).toHaveAttribute('href', '/teach');
  });

  it('links a student to the /teach info page too (no role switch yet)', () => {
    renderWithAuth({ status: 'authenticated', auth: { role: 'student' } });
    const link = screen.getByRole('link', { name: 'Teach on LearnStream' });
    expect(link).toHaveAttribute('href', '/teach');
  });

  it('links a teacher straight to their instructor dashboard', () => {
    renderWithAuth({ status: 'authenticated', auth: { role: 'teacher' } });
    const link = screen.getByRole('link', { name: 'Instructor dashboard' });
    expect(link).toHaveAttribute('href', '/instructor/courses');
  });
});
