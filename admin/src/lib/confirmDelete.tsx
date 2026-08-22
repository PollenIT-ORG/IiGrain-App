import api from "./api";
import { useDialog } from "../components/ui/DialogProvider";

// Deleting a program or a person deletes their record with them, so the panel
// says exactly what that is before it happens: the real counts, read from the
// server, and no promise that any of it can be brought back.

interface DeletionLine {
  label: string;
  count: number;
}

async function fetchSummary(path: string): Promise<DeletionLine[]> {
  try {
    const { data } = await api.get<{ data: { items: DeletionLine[] } }>(path);
    return data.data.items ?? [];
  } catch {
    // The warning is worth showing even if the counts cannot be read.
    return [];
  }
}

function Details({ items }: { items: DeletionLine[] }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
      <p className="text-sm font-semibold text-danger">
        This is permanent. Nothing here can be brought back.
      </p>
      {items.length > 0 ? (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Deleted along with it
          </p>
          <ul className="mt-1.5 space-y-1">
            {items.map((i) => (
              <li
                key={i.label}
                className="flex items-baseline justify-between gap-4 text-sm text-gray-700"
              >
                <span>{i.label}</span>
                <span className="font-bold text-gray-900">
                  {i.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-gray-600">
          There is no other record attached to it.
        </p>
      )}
    </div>
  );
}

/**
 * Asks before a delete that takes other records with it.
 *
 * Returns true when the person confirmed. The counts come from the server, so
 * the dialog names what is really there rather than what might be.
 */
export function useConfirmCascadeDelete(): (opts: {
  title: string;
  message: string;
  summaryPath: string;
  confirmLabel?: string;
}) => Promise<boolean> {
  const { confirm } = useDialog();
  return async ({ title, message, summaryPath, confirmLabel }) => {
    const items = await fetchSummary(summaryPath);
    return confirm({
      title,
      message,
      details: <Details items={items} />,
      confirmLabel: confirmLabel ?? "Delete permanently",
      tone: "danger",
    });
  };
}
