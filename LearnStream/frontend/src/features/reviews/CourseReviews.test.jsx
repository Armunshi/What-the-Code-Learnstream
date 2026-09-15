import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CourseRatingHeaderMetric } from './CourseReviews.jsx';

describe('CourseRatingHeaderMetric', () => {
  it('renders the compact header form when the course has ratings', () => {
    render(
      <CourseRatingHeaderMetric
        courseId="course-1"
        stats={{ ratingAvg: 4.7, ratingCount: 3779, enrollmentCount: 56145 }}
      />
    );

    expect(screen.getByTestId('course-rating-header-metric')).toBeInTheDocument();
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText('(3,779 ratings)')).toBeInTheDocument();
    expect(screen.getByText('56,145 students')).toBeInTheDocument();
  });

  it('renders nothing for a course with no ratings yet', () => {
    const { container } = render(
      <CourseRatingHeaderMetric courseId="course-1" stats={{ ratingAvg: 0, ratingCount: 0, enrollmentCount: 0 }} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
