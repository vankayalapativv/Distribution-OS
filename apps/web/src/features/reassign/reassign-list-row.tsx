import { ReassignAvatar } from "./reassign-avatar";
import type { ReassignCustomerRow } from "./reassign-api";

/** One customer row in the browse list: avatar + name, code·city, current owner,
 *  and the record count. Clicking it selects the customer. */
export function ReassignListRow({
  customer,
  selected,
  onSelect,
}: Readonly<{
  customer: ReassignCustomerRow;
  selected: boolean;
  onSelect: () => void;
}>) {
  const c = customer;
  const sub = [c.customerCode, c.city].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 border-b border-l-[3px] border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 ${
        selected ? "border-l-primary bg-primary/10" : "border-l-transparent"
      }`}
    >
      <ReassignAvatar id={c.id} name={c.legalName} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-card-foreground">{c.legalName}</div>
        {sub && <div className="truncate font-mono text-xs text-muted-foreground">{sub}</div>}
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {c.owner ? (
            <>
              <ReassignAvatar id={c.owner.id} name={c.owner.name} className="size-4 text-[8px]" />
              {c.owner.name}
            </>
          ) : (
            "— no owner —"
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-semibold tabular-nums text-card-foreground">{c.recordCount}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">records</div>
      </div>
    </button>
  );
}
