import { useState } from "react";
import { Link } from "react-router-dom";
import { useListLoginLogsQuery } from "../store/endpoints/loginLogsApi";
import Loader from "../components/Loader";
import { LoginLogTable } from "../components/dashboard/loginLogShared";

const PAGE_SIZE = 15;

export default function LoginLogs() {
  const [page, setPage] = useState(1);
  const { data, isLoading: loading, isError } = useListLoginLogsQuery({
    page,
    limit: PAGE_SIZE,
  });
  const logs = data?.logs ?? [];
  const meta = data?.meta ?? null;

  const totalPages = meta?.totalPages ?? 1;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="mb-1 text-sm text-gray-500">
            <Link to="/dashboard" className="hover:text-primary">
              Dashboard
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-gray-700">Login Activity</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">Login activity</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every sign-in attempt across all accounts (success &amp; failed).
          </p>
        </div>
        {meta && (
          <span className="self-start rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 sm:self-auto">
            {meta.total.toLocaleString()} total
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loader message="Loading login activity..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            Couldn't load login activity.
          </div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No login activity yet.
          </div>
        ) : (
          <>
            <LoginLogTable logs={logs} />

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-300 px-5 py-3 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-700">{page}</span>{" "}
                of{" "}
                <span className="font-semibold text-gray-700">
                  {totalPages}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!canNext}
                  className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
