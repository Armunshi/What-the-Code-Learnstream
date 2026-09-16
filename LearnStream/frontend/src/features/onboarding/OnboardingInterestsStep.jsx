import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { normalizeApiError } from '@/lib/api/errors';
import AuthContext from '@/contexts/AuthProvider';
import { fetchInterestOptions, updateOnboarding } from './api.js';

export function OnboardingInterestsStep() {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInterestOptions()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  const finish = () => {
    if (auth?.role && auth?.user_id) {
      navigate(`/${auth.role}/${auth.user_id}`);
    } else {
      navigate('/');
    }
  };

  const toggle = (slug) => {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOnboarding({ interests: selected, dismissed: true });
      finish();
    } catch (err) {
      toast.error(normalizeApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      await updateOnboarding({ dismissed: true });
    } catch {
      // Skipping should never get blocked by a failed network call.
    }
    finish();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8 flex flex-col gap-4" data-testid="onboarding-interests-step">
        <h2 className="text-xl font-bold">What are you interested in?</h2>
        <p className="text-sm text-gray-600">Pick a few topics — we'll use these to personalize your recommendations.</p>

        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected.includes(option.slug);
            return (
              <button
                key={option.slug}
                type="button"
                onClick={() => toggle(option.slug)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  isSelected ? 'border-brand-dark bg-brand-dark/10 text-brand-dark' : 'border-gray-300 text-gray-600'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Finish'}
          </Button>
          <Button type="button" variant="ghost" onClick={handleSkip} data-testid="skip-interests">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingInterestsStep;
