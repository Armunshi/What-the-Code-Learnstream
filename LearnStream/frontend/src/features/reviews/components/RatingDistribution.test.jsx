import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RatingDistribution } from './RatingDistribution.jsx';

describe('RatingDistribution', () => {
  it('renders the average and total ratings count', () => {
    render(
      <RatingDistribution
        averageRating={4.7}
        totalRatingsCount={3779}
        distribution={{ 1: 1, 2: 1, 3: 3, 4: 24, 5: 71 }}
      />
    );

    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText('3,779 ratings')).toBeInTheDocument();
  });

  it('renders a row per star bucket with its percentage', () => {
    render(
      <RatingDistribution averageRating={4} totalRatingsCount={7} distribution={{ 1: 14, 2: 0, 3: 0, 4: 0, 5: 86 }} />
    );

    expect(screen.getByText('14%')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
  });
});
