import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCourseReadiness,
  getInstructorCourse,
  publishCourse as publishCourseApi,
  unpublishCourse as unpublishCourseApi,
} from '../api';
import { instructorCourseKeys } from '../queryKeys';

export function useInstructorCourseQuery(courseId) {
  return useQuery({
    queryKey: instructorCourseKeys.detail(courseId),
    queryFn: () => getInstructorCourse(courseId),
    enabled: Boolean(courseId),
  });
}

export function useCourseReadinessQuery(courseId) {
  return useQuery({
    queryKey: instructorCourseKeys.readiness(courseId),
    queryFn: () => getCourseReadiness(courseId),
    enabled: Boolean(courseId),
    // Readiness depends on fields multiple steps write to — a short
    // staleTime keeps the sidebar's completion icons and the review step's
    // checklist reasonably fresh without refetching on every render.
    staleTime: 5_000,
  });
}

/** Updates the cached course document in place — used after an autosave or a publish/unpublish so every consumer (header, sidebar) re-renders without a network round trip. */
export function useSetCachedCourse(courseId) {
  const queryClient = useQueryClient();
  return (course) => {
    queryClient.setQueryData(instructorCourseKeys.detail(courseId), course);
    queryClient.invalidateQueries({ queryKey: instructorCourseKeys.readiness(courseId) });
  };
}

export function usePublishCourseMutation(courseId) {
  const setCachedCourse = useSetCachedCourse(courseId);
  return useMutation({
    mutationFn: () => publishCourseApi(courseId),
    onSuccess: setCachedCourse,
  });
}

export function useUnpublishCourseMutation(courseId) {
  const setCachedCourse = useSetCachedCourse(courseId);
  return useMutation({
    mutationFn: () => unpublishCourseApi(courseId),
    onSuccess: setCachedCourse,
  });
}
