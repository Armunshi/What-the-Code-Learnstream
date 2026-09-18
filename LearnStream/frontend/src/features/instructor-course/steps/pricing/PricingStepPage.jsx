import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { paiseToRupees, rupeesToPaise } from '@/lib/money';
import { updateCoursePricing } from '../../api';

// A single field with an explicit Save, not LearnersStepPage's autosave —
// price changes are infrequent and higher-stakes (they affect what a
// student is charged) than typing into a list, so a deliberate save action
// fits better than saving on every keystroke.
export function PricingStepPage() {
  const { course, onCourseSaved } = useOutletContext();
  const [rupees, setRupees] = useState(() => String(paiseToRupees(course.price)));
  const [isFree, setIsFree] = useState(course.price === 0);
  const [editVersion, setEditVersion] = useState(course.editVersion);

  const savedRupees = useMemo(() => paiseToRupees(course.price), [course.price]);
  const isDirty = isFree ? course.price !== 0 : Number(rupees) !== savedRupees;

  const mutation = useMutation({
    mutationFn: () => updateCoursePricing(course._id, { price: isFree ? 0 : rupeesToPaise(rupees), editVersion }),
    onSuccess: (result) => {
      if (result.conflict) {
        // Single-field, low-contention data — a toast plus reloading the
        // latest value is proportionate here; the full ConflictDialog modal
        // LearnersStepPage uses exists for a form with several fields where
        // silently overwriting the instructor's in-progress edits would lose
        // more than a single number.
        toast.error('This course’s pricing was changed elsewhere. Reloaded the latest price — try again.');
        onCourseSaved?.(result.current);
        setEditVersion(result.current.editVersion);
        setRupees(String(paiseToRupees(result.current.price)));
        setIsFree(result.current.price === 0);
        return;
      }

      toast.success('Pricing updated');
      onCourseSaved?.(result.course);
      setEditVersion(result.course.editVersion);
      setRupees(String(paiseToRupees(result.course.price)));
      setIsFree(result.course.price === 0);
    },
    onError: () => toast.error('Couldn’t update pricing. Try again.'),
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Pricing</h1>
        <p className="text-sm text-muted-foreground">Set what students pay for this course.</p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="course-is-free" checked={isFree} onCheckedChange={(checked) => setIsFree(Boolean(checked))} />
        <Label htmlFor="course-is-free">This course is free</Label>
      </div>

      {!isFree && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="course-price">Price (INR)</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              id="course-price"
              type="number"
              min="0"
              step="1"
              value={rupees}
              onChange={(e) => setRupees(e.target.value)}
              className="max-w-40"
            />
          </div>
        </div>
      )}

      <Button
        className="self-start"
        disabled={!isDirty || mutation.isPending || (!isFree && (rupees === '' || Number(rupees) < 0))}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Saving…' : 'Save pricing'}
      </Button>
    </div>
  );
}

export default PricingStepPage;
