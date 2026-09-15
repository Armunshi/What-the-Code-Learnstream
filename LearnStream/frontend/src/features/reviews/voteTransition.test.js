import { describe, it, expect } from 'vitest';
import { computeNextVoteStatus, VOTE_STATUS } from './voteTransition.js';

describe('computeNextVoteStatus', () => {
  it('clears the vote when the active status is clicked again', () => {
    expect(computeNextVoteStatus(VOTE_STATUS.HELPFUL, VOTE_STATUS.HELPFUL)).toBe(VOTE_STATUS.NONE);
    expect(computeNextVoteStatus(VOTE_STATUS.UNHELPFUL, VOTE_STATUS.UNHELPFUL)).toBe(VOTE_STATUS.NONE);
  });

  it('switches directly from one status to the other', () => {
    expect(computeNextVoteStatus(VOTE_STATUS.HELPFUL, VOTE_STATUS.UNHELPFUL)).toBe(VOTE_STATUS.UNHELPFUL);
    expect(computeNextVoteStatus(VOTE_STATUS.UNHELPFUL, VOTE_STATUS.HELPFUL)).toBe(VOTE_STATUS.HELPFUL);
  });

  it('sets a fresh status from NONE', () => {
    expect(computeNextVoteStatus(VOTE_STATUS.NONE, VOTE_STATUS.HELPFUL)).toBe(VOTE_STATUS.HELPFUL);
  });
});
