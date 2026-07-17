import { Link } from "react-router-dom";
import { useListLoginLogsQuery } from "../../store/endpoints/loginLogsApi";
import Loader from "../Loader";
import { LoginLogTable } from "./loginLogShared";

export default function LoginLogsTable() {
  const { data, isLoading: loading, isError } = useListLoginLogsQuery({
    limit: 8,
  });
  const logs = data?.logs ?? [];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Recent login activity
          </h2>
          <p className="text-sm text-gray-500">
            Latest sign-in attempts across all accounts
          </p>
        </div>
        <Link
          to="/login-logs"
          className="text-sm font-semibold text-primary hover:text-primary-dark"
        >
          View more
        </Link>
      </div>

      {loading ? (
        <Loader size="sm" message="Loading activity..." />
      ) : isError ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">
          Couldn't load login activity.
        </div>
      ) : logs.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">
          No login activity yet.
        </div>
      ) : (
        <>
          <LoginLogTable logs={logs} />
          <div className="border-t border-gray-300 px-5 py-3 text-center">
            <Link
              to="/login-logs"
              className="text-sm font-semibold text-primary hover:text-primary-dark"
            >
              View all login activity →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
