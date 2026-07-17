import type { LoginLog } from "../../types";

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function humanizeReason(reason: string | null): string {
  if (!reason) return "-";
  const s = reason.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function LoginLogTable({ logs }: { logs: LoginLog[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
            <th className="px-5 py-3 font-semibold">User</th>
            <th className="px-5 py-3 font-semibold">Method</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">IP</th>
            <th className="px-5 py-3 font-semibold">Reason</th>
            <th className="px-5 py-3 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
            >
              <td className="px-5 py-3.5 font-medium text-gray-900">
                {log.email}
              </td>
              <td className="px-5 py-3.5">
                <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                  {log.method}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    log.status === "success"
                      ? "bg-success/10 text-success"
                      : "bg-danger/10 text-danger"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      log.status === "success" ? "bg-success" : "bg-danger"
                    }`}
                  />
                  {log.status === "success" ? "Success" : "Failed"}
                </span>
              </td>
              <td className="px-5 py-3.5 text-gray-700">
                {log.ip_address ?? "-"}
              </td>
              <td className="px-5 py-3.5 text-gray-700">
                {humanizeReason(log.reason)}
              </td>
              <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                {formatTime(log.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
