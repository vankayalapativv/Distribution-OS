// Fallback for the @modal slot on every route that isn't an intercepted
// /settings soft-navigation (and on a hard load / refresh): render nothing.
export default function ModalDefault() {
  return null;
}
