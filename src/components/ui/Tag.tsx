/** A text-only label for a skill or technology. Not focusable and not a link. */
export function Tag({ children }: { children: string }) {
  return <span className="tag">{children}</span>;
}
