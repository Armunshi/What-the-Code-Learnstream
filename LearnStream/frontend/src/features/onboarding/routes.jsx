import { OnboardingPhoneStep } from './OnboardingPhoneStep.jsx';
import { OnboardingInterestsStep } from './OnboardingInterestsStep.jsx';

export default [
  { path: 'onboarding/phone', element: <OnboardingPhoneStep /> },
  { path: 'onboarding/interests', element: <OnboardingInterestsStep /> },
];
