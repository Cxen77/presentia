export function compareRoster(
  a: { class_roll_number?: string; roll_number?: string; full_name?: string },
  b: { class_roll_number?: string; roll_number?: string; full_name?: string },
) {
  const left = a.class_roll_number || a.roll_number || "",
    right = b.class_roll_number || b.roll_number || "";
  if (!left && right) return 1;
  if (left && !right) return -1;
  return (
    left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }) ||
    (a.full_name || "").localeCompare(b.full_name || "")
  );
}
