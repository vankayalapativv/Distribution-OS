"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/form/text-field";
import { DatePicker } from "@/features/expenditures/expenditure-date-picker";
import type { CustomerLite, Task, TaskAssignee } from "./tasks-api";
import type { TasksActionConfig } from "./tasks-shared";
import { useTaskCreate } from "./use-task-create";
import { TaskAssigneeSelect } from "./task-assignee-select";
import { TaskReminderBlock } from "./task-reminder-block";
import { TaskCustomerSelect } from "./task-customer-select";

export function TaskCreateDialog(props: {
  readonly assignees: TaskAssignee[];
  readonly customers: CustomerLite[];
  readonly actionConfig: TasksActionConfig;
  readonly onCreated: (task: Task) => void;
  readonly onError: (message: string | null) => void;
  readonly onClose: () => void;
}) {
  const t = useTaskCreate(props);

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <TextField label="Title" name="title" autoFocus required placeholder="What needs to be done?"
            value={t.title} onChange={(e) => t.setTitle(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} placeholder="Add any details…"
              value={t.description} onChange={(e) => t.setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <SearchSelect
                items={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]}
                valueKey={t.priority}
                getKey={(p) => p.value}
                getLabel={(p) => p.label}
                onSelect={(v) => v && t.setPriority(v)}
                placeholder="Select priority"
                searchPlaceholder="Search…"
                emptyText="No match"
                contentClassName="w-[200px] p-0"
              />
            </div>
            <TaskAssigneeSelect value={t.assignee} onChange={t.setAssignee} selectedAssignee={t.selectedAssignee}
              officeAssignees={t.officeAssignees} seAssignees={t.seAssignees} />
          </div>

          {!t.assigneeIsSe && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <DatePicker id="dueDate" value={t.dueDate} onChange={t.setDueDate} />
            </div>
          )}

          {t.assigneeIsSe && (
            <TaskReminderBlock assigneeName={t.selectedAssignee?.name ?? ""} dueDate={t.dueDate} setDueDate={t.setDueDate}
              time={t.time} setTime={t.setTime} remindPreview={t.remindPreview} />
          )}

          <TaskCustomerSelect customers={props.customers} value={t.customer} onChange={t.setCustomer} selectedCustomer={t.selectedCustomer} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={props.onClose}>Cancel</Button>
          <Button type="button" onClick={() => void t.handleCreate()} disabled={!t.canSubmit}>
            {t.creating ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
