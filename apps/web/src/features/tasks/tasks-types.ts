export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "high" | "medium" | "low" | string;
  status: "open" | "in_progress" | "done" | "cancelled" | string;
  dueDate: string | null;
  /** Exact reminder instant (ISO) for SE-assigned tasks; null for office to-dos. */
  remindAt: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  customerId: string | null;
  customerName: string | null;
  createdBy: string;
  createdByName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  contentType: string;
  createdAt: string;
}

export interface TaskAssignee {
  id: string;
  name: string;
  role: string;
}

export interface CustomerLite {
  id: string;
  legalName: string;
  customerCode: string;
  city: string | null;
  salesExecutiveName: string | null;
}
