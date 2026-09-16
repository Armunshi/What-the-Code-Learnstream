// Each feature owns its own keys (plan §2.1 "Keys") — lanes never share one
// keys file.
export const searchKeys = {
  trending: ['search', 'trending'],
  suggest: (q) => ['search', 'suggest', q],
  results: (params) => ['search', 'results', params],
  related: (q) => ['search', 'related', q],
  fresh: (q) => ['search', 'fresh', q],
};

export default searchKeys;
