import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { showError, showSuccess } from "../../lib/toast";
import { useDialog } from "../../components/ui/DialogProvider";
import SurveyLayout, { type SurveyStep } from "./SurveyLayout";
import Loader from "../../components/Loader";
import { surveyApi, SurveyApiError, type ContractView } from "../../lib/surveyApi";

const CLAUSES = [
  { h: "1. The program", p: "iiGrain operates a regenerative agriculture program for grain producers. The producer agrees to take part in the program for the land described in their eligibility survey, and to follow the practices agreed with their assessor." },
  { h: "2. Records and assessments", p: "The producer agrees to record field data honestly in the mobile app, including soil readings, practices and yields, and to allow an assessor to visit the land at a reasonable time each year to verify those records." },
  { h: "3. Use of data", p: "The producer keeps ownership of their farm data. iiGrain may use it to score assessments, produce reports and verify participation in the program." },
  { h: "4. Enrollment", p: "On acceptance of this signed contract, iiGrain will issue an Enrollment ID. That ID is personal to the producer and is required the first time they register in the mobile app." },
  { h: "5. Ending participation", p: "Either party may end participation with written notice. Records created before that date remain part of the program history." },
];

const RAIL: SurveyStep[] = [
  { key: "contract", title: "Sign contract", note: "Read and sign" },
];
const MAX_UPLOAD = 2_000_000;
type Mode = "type" | "draw" | "upload";

export default function SurveyContract() {
  const { token = "" } = useParams();
  const [search] = useSearchParams();
  const statusToken = search.get("s");
  const { confirm } = useDialog();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const [data, setData] = useState<ContractView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("type");
  const [typed, setTyped] = useState("");
  const [uploadData, setUploadData] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const view = await surveyApi.contract(token);
        setData(view);
        setTyped(view.producer.fullName);
        if (view.contract.signed) setDone(true);
      } catch (err) {
        setLoadError(
          err instanceof SurveyApiError ? err.message : "Could not open this contract link."
        );
      }
    })();
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#212829";
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    };
    const down = (e: PointerEvent) => { drawing.current = true; hasDrawn.current = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    const up = () => { drawing.current = false; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [mode]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErrors({ signature: "Please choose an image file." });
    if (file.size > MAX_UPLOAD) return setErrors({ signature: "Image is too large. Keep it under 2 MB." });
    const reader = new FileReader();
    reader.onload = () => {
      setUploadData(typeof reader.result === "string" ? reader.result : null);
      setErrors((p) => { const { signature: _s, ...r } = p; return r; });
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (mode === "type") {
      if (typed.trim().length < 2) next.signature = "Type your full name to sign.";
    } else if (mode === "draw") {
      if (!hasDrawn.current) next.signature = "Draw your signature in the box.";
    } else if (!uploadData) next.signature = "Upload an image of your signature.";
    if (!agreed) next.agreed = "You must accept the contract to sign it.";
    setErrors(next);
    if (Object.keys(next).length) return showError("Please complete the signature and accept the terms.");

    const ok = await confirm({
      title: "Sign this contract?",
      message: "Your signature will be recorded with the date, time and device details. This cannot be undone.",
      confirmLabel: "Sign contract",
    });
    if (!ok) return;

    setSaving(true);
    try {
      let signatureImage: string | null = null;
      if (mode === "draw") signatureImage = canvasRef.current?.toDataURL("image/png") ?? null;
      else if (mode === "upload") signatureImage = uploadData;
      await surveyApi.signContract(token, {
        signedName: mode === "type" ? typed.trim() : (data?.producer.fullName ?? ""),
        signatureImage,
      });
      setDone(true);
      showSuccess("Contract signed successfully.");
    } catch (err) {
      showError(err instanceof SurveyApiError ? err.message : "Could not sign the contract.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <SurveyLayout steps={RAIL} activeStep="contract" completedCount={0} totalCount={0}>
        <div className="card p-10 text-center">
          <h1 className="text-xl font-bold text-gray-900">This link is not available</h1>
          <p className="mt-3 text-gray-700">{loadError}</p>
        </div>
      </SurveyLayout>
    );
  }
  if (!data) {
    return (
      <SurveyLayout steps={RAIL} activeStep="contract" completedCount={0} totalCount={0}>
        <Loader message="Loading the contract..." />
      </SurveyLayout>
    );
  }
  if (done) {
    return (
      <SurveyLayout steps={RAIL} activeStep="contract" completedCount={0} totalCount={0}>
        <div className="card p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">Contract signed</h1>
          <p className="mt-3 text-gray-700">
            Thank you. Our team will review and accept it, then email you your
            Enrollment ID along with the app link.
          </p>
          {statusToken && (
            <Link to={`/survey/status/${statusToken}`} className="btn-primary mt-8">
              Back to your status
            </Link>
          )}
        </div>
      </SurveyLayout>
    );
  }

  return (
    <SurveyLayout steps={RAIL} activeStep="contract" completedCount={0} totalCount={0}>
      <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
        Program contract
      </h1>
      <p className="mt-2 text-gray-700">
        Please read this through before signing. A copy is kept on your file.
      </p>

      <div className="card mt-6 p-6 sm:p-8">
        <div className="max-h-96 space-y-6 overflow-y-auto pr-2">
          <p className="text-sm text-gray-500">
            This is placeholder wording. The final contract text will be supplied
            by the program team.
          </p>
          {CLAUSES.map((c) => (
            <div key={c.h}>
              <h2 className="text-base font-semibold text-gray-900">{c.h}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">{c.p}</p>
            </div>
          ))}
          <div className="border-t border-gray-300/70 pt-5 text-sm text-gray-700">
            <p><span className="font-semibold text-gray-900">Producer:</span> {data.producer.fullName}</p>
            <p className="mt-1"><span className="font-semibold text-gray-900">Email:</span> {data.producer.email}</p>
            <p className="mt-1"><span className="font-semibold text-gray-900">Land:</span> {data.producer.totalAcres} acres in {data.producer.state}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card mt-6 p-6 sm:p-8" noValidate>
        <h2 className="text-lg font-bold text-gray-900">Sign the contract</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {(["type", "draw", "upload"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setErrors({}); }}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                mode === m ? "border-primary bg-primary text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {m === "type" ? "Type signature" : m === "draw" ? "Draw signature" : "Upload image"}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {mode === "type" && (
            <div>
              <label htmlFor="typed" className="label">Type your full legal name</label>
              <input id="typed" className={`input-field font-serif text-lg ${errors.signature ? "input-error" : ""}`} value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={150} />
            </div>
          )}
          {mode === "draw" && (
            <div>
              <span className="label">Draw your signature</span>
              <div className={`rounded-lg border bg-white ${errors.signature ? "border-danger" : "border-gray-300"}`}>
                <canvas ref={canvasRef} width={640} height={180} className="w-full touch-none rounded-lg" style={{ height: 180 }} />
              </div>
              <button type="button" onClick={clearCanvas} className="mt-2 text-sm font-medium text-gray-500 hover:text-primary">Clear</button>
            </div>
          )}
          {mode === "upload" && (
            <div>
              <span className="label">Upload an image of your signature</span>
              <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-gray-100/60 px-6 py-8 text-center hover:bg-gray-100 ${errors.signature ? "border-danger" : "border-gray-300"}`}>
                <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
                {uploadData ? (
                  <img src={uploadData} alt="Signature preview" className="max-h-28 rounded bg-white object-contain p-2" />
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700">Click to choose an image</span>
                    <span className="mt-0.5 text-xs text-gray-500">PNG or JPG, up to 2 MB</span>
                  </>
                )}
              </label>
            </div>
          )}
          {errors.signature && <p className="field-error">{errors.signature}</p>}
        </div>

        <label className="mt-5 flex items-start gap-2.5 text-sm text-gray-700">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary" />
          <span>I have read the contract, I accept its terms, and I am authorised to sign for the land described.</span>
        </label>
        {errors.agreed && <p className="field-error">{errors.agreed}</p>}

        <button type="submit" disabled={saving} className="btn-primary mt-6 w-full">
          {saving ? "Submitting..." : "Sign and submit"}
        </button>
      </form>
    </SurveyLayout>
  );
}
