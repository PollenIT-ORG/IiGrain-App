import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetOrganizationQuery,
  useAssignUserToOrgMutation,
  useRemoveUserFromOrgMutation,
} from "../store/endpoints/organizationsApi";
import { useListUsersQuery } from "../store/endpoints/usersApi";
import { showSuccess, showError } from "../lib/toast";
import { useHere } from "../lib/returnTo";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Loader from "../components/Loader";
import {
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "../components/icons";
import { ROLE_LABELS, type UserRole } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

export default function OrganizationDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { confirm } = useDialog();
  const here = useHere();

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useGetOrganizationQuery(id, { skip: !id });

  const [pickSearch, setPickSearch] = useState("");
  const { data: usersData } = useListUsersQuery({
    page: 1,
    limit: 50,
    search: pickSearch || undefined,
  });

  const [assignUser, { isLoading: assigning }] = useAssignUserToOrgMutation();
  const [removeUser] = useRemoveUserFromOrgMutation();
  const [selectedUserId, setSelectedUserId] = useState("");

  const members = detail?.members ?? [];
  const memberIds = useMemo(
    () => new Set(members.map((m) => m.id)),
    [members]
  );

  const assignable = (usersData?.users ?? []).filter(
    (u) => !memberIds.has(u.id)
  );
  const assignOptions = [
    { value: "", label: "Select a user to add" },
    ...assignable.map((u) => ({
      value: u.id,
      label: u.full_name
        ? `${u.full_name} - ${u.email} (${ROLE_LABELS[u.role as UserRole] ?? u.role})`
        : `${u.email} (${ROLE_LABELS[u.role as UserRole] ?? u.role})`,
    })),
  ];

  async function handleAssign() {
    if (!selectedUserId) {
      showError("Please select a user to add.");
      return;
    }
    try {
      await assignUser({ orgId: id, userId: selectedUserId }).unwrap();
      showSuccess("Member added to the organization.");
      setSelectedUserId("");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleRemove(userId: string, label: string) {
    const ok = await confirm({
      title: "Remove member?",
      message: `"${label}" will be removed from this organization. Their account stays active.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await removeUser({ orgId: id, userId }).unwrap();
      showSuccess("Member removed.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading organization..." />;
  }
  if (isError || !detail) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Organizations", to: "/organizations" },
            { label: "Organization" },
          ]}
        />
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Organization not found."}
        </div>
      </div>
    );
  }

  const org = detail.organization;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Organizations", to: "/organizations" },
            { label: org.name },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {org.code}
              </span>
              {org.is_active ? (
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
          <button
            onClick={() => navigate(`/organizations/${org.id}/edit`, { state: here })}
            className="btn-secondary"
          >
            <EditIcon width={16} height={16} />
            Edit details
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Contact email" value={org.contact_email} />
          <Detail label="Contact number" value={org.contact_phone} />
          <Detail label="Address" value={org.address} />
          <Detail label="Members" value={String(org.member_count)} />
          <div className="sm:col-span-2">
            <Detail label="Description" value={org.description} />
          </div>
        </dl>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Members ({members.length})
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search users to add"
              className="input-field sm:w-56"
              value={pickSearch}
              onChange={(e) => setPickSearch(e.target.value)}
              maxLength={100}
            />
            <Select
              value={selectedUserId}
              onChange={setSelectedUserId}
              options={assignOptions}
              className="sm:w-64"
            />
            <button
              onClick={handleAssign}
              disabled={assigning || !selectedUserId}
              className="btn-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon width={16} height={16} />
              Add
            </button>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            No members yet. Add users using the controls above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {m.full_name || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{m.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {ROLE_LABELS[m.role as UserRole] ?? m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        <button
                          onClick={() =>
                            handleRemove(m.id, m.full_name || m.email)
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-danger"
                          title="Remove from organization"
                        >
                          <TrashIcon width={16} height={16} />
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
