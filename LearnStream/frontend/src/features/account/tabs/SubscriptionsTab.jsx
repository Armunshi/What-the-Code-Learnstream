import { ComingSoon } from '../components/ComingSoon.jsx';

// Plan: "subscriptions explains one-time purchases with lifetime access
// (needs product sign-off)" — LearnStream has no recurring subscription
// product today, so this tab's job is to say that plainly rather than show
// an empty "Subscriptions" list that looks broken.
export function SubscriptionsTab() {
  return (
    <ComingSoon
      title="Subscriptions"
      description="LearnStream doesn't have recurring subscriptions yet — every course you buy is a one-time purchase with lifetime access."
    />
  );
}

export default SubscriptionsTab;
