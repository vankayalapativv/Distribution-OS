export interface TaskCreateForm {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  time: string;
  assignee: string;
  customer: string;
  assigneeIsSe: boolean;
}

/** The exact reminder instant (ISO) for an SE task — date + time read as IST —
 *  or null for office tasks / incomplete timing. */
export function buildRemindAt(assigneeIsSe: boolean, dueDate: string, time: string): string | null {
  return assigneeIsSe && dueDate && time ? new Date(`${dueDate}T${time}:00+05:30`).toISOString() : null;
}

/** The POST /tasks body (trimmed title/description, nulls for empty optionals). */
export function buildTaskPayload(form: TaskCreateForm): Record<string, unknown> {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    priority: form.priority,
    dueDate: form.dueDate || null,
    remindAt: buildRemindAt(form.assigneeIsSe, form.dueDate, form.time),
    assignedTo: form.assignee || null,
    customerId: form.customer || null,
  };
}

/** An SE assignee must have both a date and a time so their phone can ring. */
export function seTimingMissing(assigneeIsSe: boolean, dueDate: string, time: string): boolean {
  return assigneeIsSe && (!dueDate || !time);
}
