import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meSummaryKeys } from '@/features/commerce/queryKeys';
import { enrollFreeCourse, fetchMeSummary } from '@/features/commerce/api';

// Legacy standalone enroll button. No current caller — the course page uses
// <PurchaseCta/> instead (docs/contracts/stubs.md), which is the frozen
// contract other lanes render for D10's full state machine (owner/enrolled/
// free/paid/teacher). Kept working against the current
// GET /users/me/summary + POST /courses/:courseId/enroll contract in case a
// future page still wants a bare enroll button.
const EnrollButton = ({ course_id, setEnroll }) => {
  const queryClient = useQueryClient();
  const [isDisabled, setIsDisabled] = useState(false);

  const { data: summary } = useQuery({ queryKey: meSummaryKeys.all, queryFn: fetchMeSummary });
  const enrolled = (summary?.enrolledCourseIds ?? []).includes(course_id);

  useEffect(() => {
    setEnroll?.(enrolled);
  }, [enrolled, setEnroll]);

  const enrollMutation = useMutation({
    mutationFn: () => enrollFreeCourse(course_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meSummaryKeys.all });
      setIsDisabled(true);
    },
  });

  return (
    <div>
      <button
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
        onClick={() => enrollMutation.mutate()}
        disabled={isDisabled || enrolled || enrollMutation.isPending}
      >
        {enrolled ? 'Already Enrolled' : 'Enroll Now'}
      </button>
    </div>
  );
};

export default EnrollButton;
