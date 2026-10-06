import { useState } from "react";
import {
  useListAssignmentsQuery,
  useAssignAssessorMutation,
  useUnassignAssessorMutation,
} from "../store/endpoints/assignmentsApi";
import { useListUsersQuery } from "../store/endpoints/usersApi";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import {
  PlusIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/icons";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 10;

export default function Assignments() {
  const { confirm } = useDialog();
  const [page, setPage] = useState(1);
  const [assessorId, setAssessorId] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading, isError, error } = useListAssignmentsQuery({
    page,
    limit: PAGE_SIZE,
  });

  const { data: assessorsData } = useListUsersQuery({
    role: "assessor",
    page: 1,
    limit: 100,
    status: "active",
  });
  const { data: farmersData } = useListUsersQuery({
    role: "farmer",
    page: 1,
    limit: 100,
    status: "active",
  });

  const [assignAssessor, { isLoading: assigning }] = useAssignAssessorMutation();
  const [unassign] = useUnassignAssessorMutation();

  const ASSESSOR_OPTIONS = [
    { value: "", label: "Select an assessor" },
    ...(assessorsData?.users ?? []).map((u) => ({
      value: u.id,
      label: u.full_name ? `${u.full_name} - ${u.email}` : u.email,
    })),
  ];
  const FARMER_OPTIONS = [
    { value: "", label: "Select a farmer" },
    ...(farmersData?.users ?? []).map((u) => ({
      value: u.id,
      label: u.full_name ? `${u.full_name} - ${u.email}` : u.email,
    })),
  ];

  async function handleAssign() {
    if (!assessorId) return showError("Please select an assessor.");
    if (!farmerId) return showError("Please select a farmer.");
    try {
      await assignAssessor({
        assessorId,
        farmerId,
        note: note.trim() || undefined,
      }).unwrap();
      showSuccess("Assessor assigned to farmer.");
      setAssessorId("");
      setFarmerId("");
      setNote("");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleUnassign(id: string, label: string) {
    const ok = await confirm({
      title: "Remove assignment?",
      message: `${label} will be unassigned. This can be re-assigned later.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await unassign(id).unwrap();
      showSuccess("Assignment removed.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const assignments = data?.assignments ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assessor Assignments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Assign an assessor to a farmer for visits. A farmer can have more than
          one assessor over time.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">New assignment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="assessor" className="label">
              Assessor <span className="text-danger">*</span>
            </label>
            <Select
              id="assessor"
              value={assessorId}
              onChange={setAssessorId}
              options={ASSESSOR_OPTIONS}
              placeholder="Select an assessor"
            />
          </div>
          <div>
            <label htmlFor="farmer" className="label">
              Farmer <span className="text-danger">*</span>
            </label>
            <Select
              id="farmer"
              value={farmerId}
              onChange={setFarmerId}
              options={FARMER_OPTIONS}
              placeholder="Select a farmer"
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="note" className="label">
            Note (optional)
          </label>
          <input
            id="note"
            className="input-field"
            placeholder="e.g. Quarterly soil-health visit"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon width={18} height={18} />
            {assigning ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader size="md" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-danger">{errMsg(error)}</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            No assignments yet.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Assessor</th>
                <th className="px-4 py-3">Farmer</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {a.assessor_name ?? "-"}
                    </div>
                    <div className="text-xs text-gray-500">{a.assessor_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {a.farmer_name ?? "-"}
                    </div>
                    <div className="text-xs text-gray-500">{a.farmer_email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {a.note ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        handleUnassign(
                          a.id,
                          `${a.assessor_name ?? a.assessor_email} → ${a.farmer_name ?? a.farmer_email}`
                        )
                      }
                      className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-danger/10 hover:text-danger"
                      title="Remove assignment"
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && !isError && assignments.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
            <span className="text-gray-500">
              Page {meta?.page ?? 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-50"
              >
                <ChevronLeftIcon width={16} height={16} />
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-50"
              >
                Next
                <ChevronRightIcon width={16} height={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
