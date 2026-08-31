import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeftIcon } from "../components/icons";
import FieldMonitoringPanel from "../components/fieldMonitoring/FieldMonitoringPanel";
import { MODULES, MODULE_BY_KEY } from "../lib/fieldModules";
import { useGetFieldModulesQuery } from "../store/endpoints/fieldMonitoringApi";
import type { ModuleKey } from "../types";

/** A field's monitoring record on its own page, with the field named at the top. */
export default function FieldMonitoring() {
  const { fieldId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const requested = params.get("tab") as ModuleKey | null;
  const tab = requested && MODULE_BY_KEY[requested] ? requested : MODULES[0].key;

  const { data: summary } = useGetFieldModulesQuery(fieldId, { skip: !fieldId });
  const context = summary?.context;

  function switchTab(next: ModuleKey) {
    params.set("tab", next);
    setParams(params, { replace: true });
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Field Monitoring</h1>
      </div>

      {context && (
        <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Farm", context.farmName],
            ["Field", context.fieldName],
            [
              "Records",
              String((summary?.modules ?? []).reduce((n, m) => n + m.total, 0)),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
              <p className="mt-0.5 font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      <FieldMonitoringPanel fieldId={fieldId} tab={tab} onTabChange={switchTab} />
    </div>
  );
}
