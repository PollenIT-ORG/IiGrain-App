import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetUserQuery,
  useSetUserStatusMutation,
  useDeleteUserMutation,
} from "../store/endpoints/usersApi";
import { useListFarmsQuery } from "../store/endpoints/farmsApi";
import Loader from "../components/Loader";
import { ChevronLeftIcon, EditIcon, TrashIcon } from "../components/icons";
import { ROLE_LABELS, type User, type UserRole } from "../types";
import { showSuccess, showError } from "../lib/toast";
import { useConfirmCascadeDelete } from "../lib/confirmDelete";
import { fmtDateTime } from "../lib/datetime";
import { useFarmWorkbook } from "../lib/useFarmWorkbook";
import { useDialog } from "../components/ui/DialogProvider";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

function formatDate(iso: string | null): string {
  return fmtDateTime(iso);
}

export default function UserDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();

  const { data: user, isLoading, isError, error } = useGetUserQuery(id, {
    skip: !id,
  });

  const [setStatus, { isLoading: statusSaving }] = useSetUserStatusMutation();
  const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation();
  const confirmDelete = useConfirmCascadeDelete();

  async function handleToggleStatus() {
    if (!user) return;
    const next = !user.is_active;
    try {
      await setStatus({ id: user.id, isActive: next }).unwrap();
      showSuccess(next ? "User activated." : "User deactivated.");
    } catch (err) {
      showError((err as { message?: string })?.message ?? "Could not update status.");
    }
  }

  async function handleDelete() {
    if (!user) return;
    const who = user.full_name || user.email;
    const ok = await confirmDelete({
      title: "Delete this account and all of its data?",
      message:
        `Everything belonging to ${who} is deleted with the account. ` +
        "This is how the numbers stay right - nothing is left behind without " +
        "an owner.",
      summaryPath: `/users/${user.id}/deletion-summary`,
    });
    if (!ok) return;
    try {
      await deleteUser(user.id).unwrap();
      showSuccess("User deleted.");
      navigate("/users");
    } catch (err) {
      showError((err as { message?: string })?.message ?? "Could not delete user.");
    }
  }

  const isFarmer = user?.role === "farmer";
  const { data: farmsData, isFetching: farmsLoading } = useListFarmsQuery(
    { page: 1, limit: 100, ownerId: id },
    { skip: !id || !isFarmer }
  );
  const farms = farmsData?.farms ?? [];
  const { download, downloadMany, countExportable, busyFarmId } =
    useFarmWorkbook();
  const { confirm } = useDialog();
  const [exportingAll, setExportingAll] = useState(false);

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading user..." />;
  }
  if (isError || !user) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/users")}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to users
        </button>
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "User not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/users")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to users
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user.full_name || user.email}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {ROLE_LABELS[user.role as UserRole] ?? user.role}
              </span>
              {user.is_active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                  Inactive
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleStatus}
              disabled={statusSaving}
              className="btn-secondary"
            >
              {user.is_active ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => navigate(`/users/${user.id}/edit`)}
              className="btn-secondary"
            >
              <EditIcon width={16} height={16} />
              Edit user
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary text-danger hover:bg-danger/5"
            >
              <TrashIcon width={16} height={16} />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Email" value={user.email} />
          <Detail label="Phone" value={user.phone} />
          <Detail
            label="Email verified"
            value={user.is_email_verified ? "Yes" : "No"}
          />
          <Detail label="Last login" value={formatDate(user.last_login_at)} />
          <Detail label="Joined" value={formatDate(user.created_at)} />
        </dl>
      </div>

      {isFarmer && (
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Farms ({farms.length})
            </h2>
            {farms.length > 0 && (
              <button
                onClick={async () => {
                  setExportingAll(true);
                  try {
                    const list = farms.map((f) => ({ id: f.id, name: f.name }));
                    const ready = await countExportable(list);
                    if (ready === 0) {
                      showError(
                        "None of these farms have fields enrolled in a program yet."
                      );
                      return;
                    }
                    // Their workbook holds one Farm ID, so each farm is its own
                    // file. Better said before the downloads start than after.
                    const yes = await confirm({
                      title: `Download ${ready} file${ready === 1 ? "" : "s"}?`,
                      message:
                        ready === 1
                          ? "One farm has monitoring data, so one workbook will be downloaded."
                          : `${ready} farms have monitoring data. The client's workbook covers one farm, so this downloads ${ready} separate files.`,
                      confirmLabel: "Download",
                    });
                    if (!yes) return;
                    await downloadMany(list);
                  } finally {
                    setExportingAll(false);
                  }
                }}
                disabled={exportingAll}
                className="btn-secondary shrink-0 py-2 text-sm"
              >
                {exportingAll ? "Preparing..." : "Export All Farm Report"}
              </button>
            )}
          </div>
          {farmsLoading ? (
            <Loader message="Loading farms..." />
          ) : farms.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">
              This farmer has no farms.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Farm</th>
                    <th className="px-5 py-3 font-semibold">Location</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {f.name}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {f.location || "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.is_active ? (
                          <span className="text-xs font-semibold text-success">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() =>
                              void download(f.id, { farmName: f.name })
                            }
                            disabled={busyFarmId === f.id}
                            className="text-sm font-medium text-gray-600 hover:text-primary disabled:opacity-50"
                            title="Download this farm's full workbook"
                          >
                            {busyFarmId === f.id ? "Preparing..." : "Export"}
                          </button>
                          <button
                            onClick={() => navigate(`/farms/${f.id}`)}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{value || "-"}</dd>
    </div>
  );
}

export type { User };
