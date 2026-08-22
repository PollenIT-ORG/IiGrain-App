import type { ReactNode } from "react";
import Logo from "../../components/Logo";

export interface SurveyStep {
  key: string;
  title: string;
  note: string;
}

// The shared shell for the public survey. Everything - the logo, the progress,
// the steps, the safety note, the tagline and the copyright - lives inside one
// cohesive left panel that is fixed to the edge and runs the full height. The
// page content sits to its right. No separate admin header.
export default function SurveyLayout({
  steps,
  activeStep,
  completedCount,
  totalCount,
  children,
}: {
  steps: SurveyStep[];
  activeStep: string;
  completedCount: number;
  totalCount: number;
  children: ReactNode;
}) {
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.key === activeStep)
  );
  const currentStep = Math.min(completedCount + 1, totalCount || 1);

  return (
    <div className="flex flex-col bg-gray-100 lg:h-screen lg:overflow-hidden">
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* One cohesive sidebar: logo, progress, steps, safety note and tagline.
            Flush to the left edge and full height; scrolls on its own if long. */}
        <aside className="flex w-full shrink-0 flex-col border-b border-gray-300/70 bg-white lg:w-[300px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          {/* Logo - left aligned with the panel content below it. */}
          <div className="flex items-center border-b border-gray-300/70 px-5 py-5">
            <Logo size="md" />
          </div>

          {/* Progress + steps + safety note + tagline */}
          <div className="flex flex-1 flex-col px-5 py-6">
          <p className="text-base font-bold text-gray-900">Survey Progress</p>

          {totalCount > 0 && (
            <>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Overall Progress</span>
                <span className="text-gray-500">
                  Step {currentStep} of {totalCount}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-300/60">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  {completedCount} of {totalCount} questions completed
                </span>
                <span className="font-semibold text-gray-700">{pct}%</span>
              </div>
            </>
          )}

          <ol className="mt-5 space-y-3">
            {steps.map((s, i) => {
              const done = i < activeIndex;
              const current = i === activeIndex;
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    current
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      done || current
                        ? "bg-primary text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-bold ${current ? "text-primary" : "text-gray-900"}`}
                    >
                      {s.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{s.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Pushes the safety note and tagline toward the bottom of the panel. */}
          <div className="min-h-[2rem] flex-1" />

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              </svg>
              Your information is safe
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
              Your responses are confidential and will only be used to determine
              program eligibility.
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <svg
              className="shrink-0 text-primary"
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 22a1 1 0 0 1-1-1v-9a1 1 0 1 1 2 0v9a1 1 0 0 1-1 1Z" />
              <path d="M11 13c0-3.3-2.5-6-6-6 0 3.3 2.5 6 6 6Z" />
              <path d="M13 13c0-3.3 2.5-6 6-6 0 3.3-2.5 6-6 6Z" />
              <path d="M11.5 9c0-2.5-2-4.5-4.5-4.5 0 2.5 2 4.5 4.5 4.5Z" />
              <path d="M12.5 9c0-2.5 2-4.5 4.5-4.5 0 2.5-2 4.5-4.5 4.5Z" />
            </svg>
            <p className="text-xs leading-snug text-gray-600">
              Building healthy soil. Strong communities. A sustainable future.
            </p>
          </div>
          </div>
        </aside>

        {/* Main content - scrolls on its own so the shell stays put. */}
        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
