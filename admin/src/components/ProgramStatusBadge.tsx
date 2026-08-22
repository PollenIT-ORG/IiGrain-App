// A program's real, date-aware status. The stored `is_active` flag alone is not
// enough - a program can be flagged active yet already be past its end date, or
// not have started yet. This derives what an admin should actually see.

interface ProgramLike {
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

interface StatusStyle {
  label: string;
  dot: string;
  chip: string;
}

export function programStatus(p: ProgramLike): StatusStyle {
  // Local calendar day (not UTC) so the status flips at the admin's midnight,
  // matching how the dates read on screen.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Manually turned off wins over any date - the admin closed it on purpose.
  if (!p.is_active) {
    return { label: "Inactive", dot: "bg-gray-500", chip: "bg-gray-200 text-gray-600" };
  }
  // Past its end date - the program has run its course.
  if (p.end_date && p.end_date < today) {
    return { label: "Ended", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700" };
  }
  // Starts in the future - live, but not open yet.
  if (p.start_date && p.start_date > today) {
    return { label: "Scheduled", dot: "bg-info", chip: "bg-info/10 text-info" };
  }
  return { label: "Active", dot: "bg-success", chip: "bg-success/10 text-success" };
}

export default function ProgramStatusBadge({
  program,
  className = "",
}: {
  program: ProgramLike;
  className?: string;
}) {
  const s = programStatus(program);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.chip} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
