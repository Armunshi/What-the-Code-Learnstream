// Public API surface of the auth feature. docs/lanes/auth.json owns
// features/auth/** as a whole, EXCEPT LoginPromptDialog.jsx and
// useRequireAuth.jsx, which docs/lanes/w0-a.json carves out for W0-A to
// create and keep. This barrel re-exports those two so other features
// still import everything auth-related from 'features/auth' the same way
// they'd import from any other feature, without needing to know that one
// file inside it belongs to a different lane than the rest.
export { LoginPromptDialog } from './LoginPromptDialog.jsx';
export { useRequireAuth, useLoginPromptStore } from './useRequireAuth.jsx';
export { SignupForm } from './SignupForm.jsx';
