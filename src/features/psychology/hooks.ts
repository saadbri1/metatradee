'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOverviewAction,
  createGoalAction,
  setGoalStatusAction,
  deleteGoalAction,
  createHabitAction,
  logHabitAction,
  deleteHabitAction,
  addPsychologyEntryAction,
} from './server/actions';
import type { GoalInput, HabitInput, HabitLogInput, PsychologyEntryInput } from './schemas';
import type { ActionResult, GoalStatus } from './types';

export function usePsychologyOverview() {
  return useQuery({
    queryKey: ['psychology', 'overview'],
    queryFn: () => getOverviewAction(),
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['psychology'] });
}

export function useCreateGoal() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ id: string }>, Error, GoalInput>({
    mutationFn: (input) => createGoalAction(input),
    onSuccess: () => invalidate(),
  });
}
export function useSetGoalStatus() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, { id: string; status: GoalStatus }>({
    mutationFn: ({ id, status }) => setGoalStatusAction(id, status),
    onSuccess: () => invalidate(),
  });
}
export function useDeleteGoal() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (id) => deleteGoalAction(id),
    onSuccess: () => invalidate(),
  });
}
export function useCreateHabit() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ id: string }>, Error, HabitInput>({
    mutationFn: (input) => createHabitAction(input),
    onSuccess: () => invalidate(),
  });
}
export function useLogHabit() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, HabitLogInput>({
    mutationFn: (input) => logHabitAction(input),
    onSuccess: () => invalidate(),
  });
}
export function useDeleteHabit() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (id) => deleteHabitAction(id),
    onSuccess: () => invalidate(),
  });
}
export function useAddPsychologyEntry() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ id: string }>, Error, PsychologyEntryInput>({
    mutationFn: (input) => addPsychologyEntryAction(input),
    onSuccess: () => invalidate(),
  });
}
