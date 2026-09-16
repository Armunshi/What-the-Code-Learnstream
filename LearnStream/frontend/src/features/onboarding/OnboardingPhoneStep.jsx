import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { normalizeApiError } from '@/lib/api/errors';
import { updateOnboarding } from './api.js';

// Not SMS-verified (plan note) — this number is stored as-is and the UI
// never claims any recovery/2FA use of it.
export function OnboardingPhoneStep() {
  const [phone, setPhone] = useState('+91');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const goNext = () => navigate('/onboarding/interests');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOnboarding({ phone });
      goNext();
    } catch (err) {
      toast.error(normalizeApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-8 flex flex-col gap-4" data-testid="onboarding-phone-step">
        <h2 className="text-xl font-bold">Add your phone number</h2>
        <p className="text-sm text-gray-600">Optional — helps us reach you about your courses. Not used for sign-in.</p>

        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="flex gap-2 mt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Continue'}
          </Button>
          <Button type="button" variant="ghost" onClick={goNext} data-testid="skip-phone">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPhoneStep;
