import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetProgramQuery,
  useLazySuggestProgramCodeQuery,
  useCreateProgramMutation,
  useUpdateProgramMutation,
} from "../store/endpoints/programsApi";
import { showSuccess, showError } from "../lib/toast";
import { required, isClean } from "../lib/validation";
import Loader from "../components/Loader";
import Select from "../components/ui/Select";
import { ChevronLeftIcon } from "../components/icons";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const TYPE_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "government", label: "Government scheme" },
  { value: "private", label: "Private program" },
  { value: "ngo", label: "NGO / Non-profit" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function ProgramForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [userLimit, setUserLimit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  // A code typed by hand is never overwritten by the suggested one.
  const [codeTouched, setCodeTouched] = useState(false);

  const {
    data: program,
    isLoading: loading,
    isError: loadError,
  } = useGetProgramQuery(id ?? "", { skip: !isEdit });

  const [createProgram, { isLoading: creating }] = useCreateProgramMutation();
  const [updateProgram, { isLoading: updating }] = useUpdateProgramMutation();
  const saving = creating || updating;

  useEffect(() => {
    if (program) {
      setName(program.name);
      setCode(program.code ?? "");
      // An existing code stands; one that was never set still gets suggested.
      setCodeTouched(Boolean(program.code));
      setType(program.type ?? "");
      setDescription(program.description ?? "");
      setStartDate(program.start_date ?? "");
      setEndDate(program.end_date ?? "");
      if (program.user_limit === null) {
        setUnlimited(true);
        setUserLimit("");
      } else {
        setUnlimited(false);
        setUserLimit(String(program.user_limit));
      }
      setIsActive(program.is_active);
    }
  }, [program]);

  // Suggest a code from the name - the initials and a free number - so nobody
  // has to invent one. It follows the name until the code is edited by hand.
  const [askForCode] = useLazySuggestProgramCodeQuery();
  useEffect(() => {
    if (codeTouched) return;
    const typed = name.trim();
    if (typed.length < 2) return;
    const t = setTimeout(() => {
      void askForCode(typed)
        .unwrap()
        .then((suggested) => {
          // Still wanted by the time it came back.
          setCode((current) => (codeTouched ? current : suggested));
        })
        .catch(() => {
          // A suggestion is a convenience; the field stays as it is.
        });
    }, 400);
    return () => clearTimeout(t);
  }, [name, codeTouched, askForCode]);

  useEffect(() => {
    if (loadError) {
      showError("Program not found.");
      navigate("/programs");
    }
  }, [loadError, navigate]);

  function validate(): boolean {
    const next: Record<string, string | null> = {
      name: required(name, "Program name"),
      userLimit: null,
      dates: null,
    };
    if (!unlimited) {
      const n = Number(userLimit);
      // A limit of zero would let nobody enrol, so the server starts at 1 and
      // "no limit" is the checkbox rather than a zero.
      if (
        userLimit.trim() === "" ||
        Number.isNaN(n) ||
        !Number.isInteger(n) ||
        n < 1
      ) {
        next.userLimit = "Enter a whole number (1 or more), or choose No Limit.";
      } else if (n > 1000000) {
        next.userLimit = "User limit looks too large. Please check the value.";
      }
    }
    if (startDate && endDate && endDate < startDate) {
      next.dates = "End date cannot be before start date.";
    }
    setErrors(next);
    return isClean(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const body = {
      name: name.trim(),
      code: code.trim() || null,
      type: type || null,
      description: description.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      userLimit: unlimited ? null : Number(userLimit),
      isActive,
    };

    try {
      if (isEdit && id) {
        await updateProgram({ id, body }).unwrap();
        showSuccess("Program updated.");
      } else {
        await createProgram(body).unwrap();
        showSuccess("Program created.");
      }
      navigate("/programs");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isEdit && loading) {
    return <Loader variant="fullPage" message="Loading program..." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <button
          onClick={() => navigate("/programs")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to programs
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Edit program" : "Add program"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit
            ? "Update this scheme's details and enrollment limit."
            : "Create a scheme. Enroll farmers and their fields afterwards."}
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <p className="text-xs text-gray-500">
            Fields marked <span className="text-danger">*</span> are required.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">
                Program name <span className="text-danger">*</span>
              </label>
              <input
                id="name"
                className={`input-field ${errors.name ? "input-error" : ""}`}
                placeholder="Govt Wheat Scheme 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="code" className="label">
                Code
              </label>
              <input
                id="code"
                className="input-field"
                placeholder="GWS-2026"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeTouched(true);
                }}
                maxLength={50}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Filled in from the program name. Change it if you use codes of
                your own.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="type" className="label">
                Type
              </label>
              <Select
                id="type"
                value={type}
                onChange={setType}
                options={TYPE_OPTIONS}
              />
            </div>
            <div>
              <label htmlFor="status" className="label">
                Status
              </label>
              <Select
                id="status"
                value={isActive ? "active" : "inactive"}
                onChange={(v) => setIsActive(v === "active")}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="label">
                Start date
              </label>
              <input
                id="startDate"
                type="date"
                className={`input-field ${errors.dates ? "input-error" : ""}`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="endDate" className="label">
                End date
              </label>
              <input
                id="endDate"
                type="date"
                className={`input-field ${errors.dates ? "input-error" : ""}`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {errors.dates && <p className="field-error -mt-3">{errors.dates}</p>}

          <div>
            <label className="label">Enrollment limit (farmers)</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                />
                No Limit
              </label>
              <input
                type="number"
                min="1"
                max="1000000"
                step="1"
                className={`input-field w-40 ${errors.userLimit ? "input-error" : ""} ${
                  unlimited ? "opacity-50" : ""
                }`}
                placeholder="e.g. 50"
                value={userLimit}
                onChange={(e) => setUserLimit(e.target.value)}
                disabled={unlimited}
              />
            </div>
            {errors.userLimit ? (
              <p className="field-error">{errors.userLimit}</p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                Maximum farmers that can enroll. Check “No Limit” for no cap.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              className="input-field min-h-[90px] resize-y"
              placeholder="A short description of this scheme (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/programs")}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? "Saving..."
                : isEdit
                  ? "Save changes"
                  : "Create program"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
