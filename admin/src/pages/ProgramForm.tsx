import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useGetProgramQuery,
  useLazySuggestProgramCodeQuery,
  useCreateProgramMutation,
  useUpdateProgramMutation,
} from "../store/endpoints/programsApi";
import { useSeedOnce } from "../lib/useSeedOnce";
import { showSuccess, showError } from "../lib/toast";
import { required, isClean } from "../lib/validation";
import { useReturnTo, useTrail } from "../lib/returnTo";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import { useAuth } from "../store/useAuth";
import Loader from "../components/Loader";
import Select from "../components/ui/Select";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import AssessmentCategories from "./AssessmentCategories";
import {
  ContractStep,
  ShareStep,
  Steps,
  SurveyStep,
  useProgramSurveyLink,
} from "./ProgramSurveySetup";
import type { Program } from "../types";

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

const STEPS = ["Program", "Assessment", "Survey", "Contract", "Share"] as const;

export default function ProgramForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id = "" } = useParams();
  const isEdit = Boolean(id);
  const [params, setParams] = useSearchParams();
  const back = useReturnTo("/programs");
  const trail = useTrail();
  const programCrumbs = useProgramCrumbs(id);
  const creating = Boolean(
    (location.state as { creating?: boolean } | null)?.creating
  );
  const { user } = useAuth();
  const isPlatformAdmin =
    user?.role === "admin" || user?.role === "super_admin";

  const {
    data: program,
    isLoading: loading,
    isFetching: refreshing,
    isError: loadError,
  } = useGetProgramQuery(id, { skip: !isEdit });
  const { link, setFresh, loading: loadingLink } = useProgramSurveyLink(id);

  // Opening the assessment of a new program saves it first; the steps after it need the saved program.
  function reachable(i: number): boolean {
    if (i === 0) return true;
    if (!isEdit) return i === 1;
    return i <= 2 || Boolean(link);
  }

  const requested = Number(params.get("step")) - 1;
  const step =
    isEdit && requested >= 0 && requested < STEPS.length && reachable(requested) ? requested : 0;

  function setStep(next: number) {
    setParams({ step: String(next + 1) }, { replace: true, state: location.state });
  }

  const details = useRef<DetailsStepHandle>(null);

  function pickStep(next: number) {
    if (isEdit) setStep(next);
    else if (next === 1) void details.current?.submit();
  }

  useEffect(() => {
    if (loadError) {
      showError("Program not found.");
      navigate("/programs");
    }
  }, [loadError, navigate]);

  if (isEdit && (loading || (step >= 2 && loadingLink))) {
    return <Loader variant="fullPage" message="Loading program..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={
            isEdit
              ? [...programCrumbs, { label: creating ? "Setup" : "Edit" }]
              : [
                  ...(trail ?? [{ label: "Programs", to: "/programs" }]),
                  { label: "Add program" },
                ]
          }
        />
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit && !creating ? "Edit program" : "Add program"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {step > 0
            ? program?.name
            : isEdit
              ? "Update this scheme's details and enrollment limit."
              : "Create a scheme. Enroll farmers and their fields afterwards."}
        </p>
      </div>

      <Steps labels={STEPS} current={step} reachable={reachable} onPick={pickStep} />

      {step === 0 && (
        <DetailsStep
          ref={details}
          program={program}
          refreshing={refreshing}
          onCancel={() => back.go()}
          onCreated={(created) =>
            navigate(`/programs/${created.id}/edit?step=2`, {
              replace: true,
              state: { from: `/programs/${created.id}`, creating: true },
            })
          }
          onUpdated={(continueSetup) =>
            continueSetup ? setStep(1) : back.go()
          }
        />
      )}
      {step === 1 && (
        <AssessmentStep
          programId={id}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <>
          <SurveyStep
            programId={id}
            link={link}
            onCreated={setFresh}
            onRemoved={() => {
              setFresh(null);
              setStep(2);
            }}
            onNext={() => setStep(3)}
          />
          {!link && (
            <div className="flex justify-between gap-3">
              <button className="btn-secondary" onClick={() => setStep(1)}>
                <ChevronLeftIcon width={16} height={16} />
                Back to the assessment
              </button>
              <button
                className="btn-secondary"
                onClick={() => navigate(`/programs/${id}`)}
              >
                Finish later
              </button>
            </div>
          )}
        </>
      )}
      {step === 3 && (
        <ContractStep
          key={link?.id ?? "none"}
          link={link}
          isPlatformAdmin={isPlatformAdmin}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && <ShareStep link={link} programId={id} />}
    </div>
  );
}

function AssessmentStep({
  programId,
  onBack,
  onNext,
}: {
  programId: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="card p-6">
        <AssessmentCategories programId={programId} />
      </div>
      <div className="flex justify-between gap-3">
        <button className="btn-secondary" onClick={onBack}>
          <ChevronLeftIcon width={16} height={16} />
          Back to the program
        </button>
        <button className="btn-primary" onClick={onNext}>
          Continue to the survey
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>
    </>
  );
}

interface DetailsStepHandle {
  submit: () => Promise<void>;
}

interface DetailsStepProps {
  program: Program | undefined;
  refreshing: boolean;
  onCancel: () => void;
  onCreated: (created: Program) => void;
  onUpdated: (continueSetup: boolean) => void;
}

const DetailsStep = forwardRef<DetailsStepHandle, DetailsStepProps>(function DetailsStep(
  { program, refreshing, onCancel, onCreated, onUpdated },
  ref
) {
  const isEdit = Boolean(program);

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

  const [createProgram, { isLoading: creating }] = useCreateProgramMutation();
  const [updateProgram, { isLoading: updating }] = useUpdateProgramMutation();
  const saving = creating || updating;

  useSeedOnce(program, program?.id, refreshing, (p) => {
    setName(p.name);
    setCode(p.code ?? "");
    // An existing code stands; one that was never set still gets suggested.
    setCodeTouched(Boolean(p.code));
    setType(p.type ?? "");
    setDescription(p.description ?? "");
    setStartDate(p.start_date ?? "");
    setEndDate(p.end_date ?? "");
    if (p.user_limit === null) {
      setUnlimited(true);
      setUserLimit("");
    } else {
      setUnlimited(false);
      setUserLimit(String(p.user_limit));
    }
    setIsActive(p.is_active);
  });

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

  function validate(): boolean {
    const next: Record<string, string | null> = {
      name: required(name, "Program name"),
      userLimit: null,
      dates: null,
    };
    if (!unlimited) {
      const n = Number(userLimit);
      // A limit of zero would let nobody enroll, so the server starts at 1 and
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

  const datesError =
    startDate && endDate && endDate < startDate
      ? "End date cannot be before start date."
      : errors.dates;

  async function submitForm(continueSetup: boolean) {
    if (saving || !validate()) return;

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
      if (program) {
        await updateProgram({ id: program.id, body }).unwrap();
        showSuccess("Program updated.");
        onUpdated(continueSetup);
      } else {
        // A new program starts from the Global template; the next step can swap it or start blank.
        const created = await createProgram(body).unwrap();
        showSuccess("Program created.");
        onCreated(created);
      }
    } catch (err) {
      showError(errMsg(err));
    }
  }

  function handleSubmit(e: SyntheticEvent, continueSetup: boolean) {
    e.preventDefault();
    void submitForm(continueSetup);
  }

  useImperativeHandle(ref, () => ({ submit: () => submitForm(false) }));

  return (
    <div className="card p-6 sm:p-8">
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5" noValidate>
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
              className={`input-field ${datesError ? "input-error" : ""}`}
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
              min={startDate || undefined}
              className={`input-field ${datesError ? "input-error" : ""}`}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {datesError && <p className="field-error -mt-3">{datesError}</p>}

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

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              disabled={saving}
              className="btn-secondary"
              onClick={(e) => handleSubmit(e, true)}
            >
              Save and continue
            </button>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Create and continue"}
          </button>
        </div>
      </form>
    </div>
  );
});
