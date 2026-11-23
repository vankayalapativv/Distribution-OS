import { avatarColor, initials } from "./reassign-logic";

/** Small round initials avatar, coloured deterministically from the id. */
export function ReassignAvatar({
  id,
  name,
  className = "size-8 text-xs",
}: {
  readonly id: string;
  readonly name: string;
  readonly className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${avatarColor(id)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
