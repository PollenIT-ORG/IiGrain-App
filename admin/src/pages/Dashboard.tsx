import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ComponentType, SVGProps } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/useAuth";
import { downloadWorkbook, fileStamp, type Sheet } from "../lib/workbook";
import StatCard from "../components/dashboard/StatCard";
import LoginLogsTable from "../components/dashboard/LoginLogsTable";
import Loader from "../components/Loader";
import {
  FarmIcon,
  ChartIcon,
  UsersIcon,
  LeafIcon,
  FileIcon,
  FieldsIcon,
  LinkIcon,
} from "../components/icons";
import {
  useGetAdminDashboardQuery,
  useGetProgramDashboardQuery,
  type AdminDashboardData,
} from "../store/endpoints/dashboardApi";
import { usePasSubmissionStatsQuery } from "../store/endpoints/programAdminSurveyApi";
import ProgramSubmissionCards from "../components/ProgramSubmissionCards";
import { isProgramAdmin } from "../lib/access";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";

const axisStyle = { fontSize: 12, fill: "#495057" };
const gridStroke = "#DEE2E6";

const nfmt = new Intl.NumberFormat("en-US");

/**
 * The dashboard as a workbook: a sheet of headline numbers and one per chart,
 * so the file reads the way the screen does rather than as one long column of
 * comma-separated text.
 */
async function exportDashboard(data: AdminDashboardData): Promise<void> {
  const sheets: Sheet[] = [
    {
      name: "Summary",
      title: "Dashboard report",
      columns: [
        { header: "Metric", width: 34 },
        { header: "Value", type: "number", width: 16 },
      ],
      rows: [
        ["Acreage enrolled", data.kpis?.enrolledAcreage ?? 0],
        ["Farms enrolled", data.kpis?.farmsEnrolled ?? 0],
        ["Farmers enrolled", data.kpis?.farmersEnrolled ?? 0],
        ["Fields enrolled", data.kpis?.fieldsEnrolled ?? 0],
        ["Assessments submitted", data.kpis?.assessmentsSubmitted ?? 0],
        ["Assessment completion %", data.kpis?.completionPct ?? 0],
        ["Average RHI score", data.kpis?.avgRhi ?? 0],
        ["Programs", data.kpis?.totalPrograms ?? 0],
      ],
    },
  ];

  if (data.acreageEnrolled?.length) {
    sheets.push({
      name: "Acreage by month",
      title: "Acreage enrolled by month",
      columns: [
        { header: "Month", width: 16 },
        { header: "Acres", type: "number", total: "sum", width: 16 },
      ],
      rows: data.acreageEnrolled.map((r) => [r.month, r.acres]),
    });
  }
  if (data.programSplit?.length) {
    sheets.push({
      name: "By program",
      title: "Enrollment by program",
      columns: [
        { header: "Program", width: 34 },
        { header: "Acres", type: "number", total: "sum", width: 14 },
        { header: "Share %", type: "number", width: 12 },
      ],
      rows: data.programSplit.map((r) => [r.name, r.acres ?? 0, r.value]),
    });
  }
  if (data.assessmentTrends?.length) {
    sheets.push({
      name: "Assessments",
      title: "Assessment trends",
      columns: [
        { header: "Month", width: 16 },
        { header: "Submissions", type: "number", total: "sum", width: 16 },
        { header: "Average score", type: "number", total: "average", width: 16 },
      ],
      rows: data.assessmentTrends.map((r) => [r.month, r.completion, r.score]),
    });
  }
  if (data.rhiByProgram?.length) {
    sheets.push({
      name: "RHI by program",
      title: "RHI by program",
      columns: [
        { header: "Program", width: 34 },
        { header: "RHI", type: "number", total: "average", width: 12 },
      ],
      rows: data.rhiByProgram.map((r) => [r.region, r.rhi]),
    });
  }

  await downloadWorkbook(`dashboard-report-${fileStamp()}`, sheets);
}

// The Programs tiles, coloured the way the submission tiles are so the two
// sections read as one dashboard.
const PROGRAM_TILES: Array<{
  key:
    | "totalPrograms"
    | "enrolledFarmers"
    | "fieldsEnrolled"
    | "assessmentSubmissions"
    | "farmersWithAssessor"
    | "farmersFullyAssessed";
  label: string;
  sub: string;
  wrap: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  {
    key: "totalPrograms",
    label: "Programs",
    sub: "Running now",
    wrap: "bg-primary/10 text-primary",
    Icon: LinkIcon,
  },
  {
    key: "enrolledFarmers",
    label: "Farmers enrolled",
    sub: "Taking part",
    wrap: "bg-secondary/10 text-secondary",
    Icon: UsersIcon,
  },
  {
    key: "fieldsEnrolled",
    label: "Fields enrolled",
    sub: "Under a program",
    wrap: "bg-amber-100 text-amber-600",
    Icon: FieldsIcon,
  },
  {
    key: "assessmentSubmissions",
    label: "Assessment submissions",
    sub: "Farmer and assessor",
    wrap: "bg-blue-100 text-blue-600",
    Icon: FileIcon,
  },
  {
    key: "farmersWithAssessor",
    label: "Farmers with an assessor",
    sub: "Assigned",
    wrap: "bg-indigo-100 text-indigo-600",
    Icon: UsersIcon,
  },
  {
    key: "farmersFullyAssessed",
    label: "Assessed by both sides",
    sub: "Farmer and assessor done",
    wrap: "bg-success/10 text-success",
    Icon: ChartIcon,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = (user?.fullName || "Admin").split(" ")[0];

  // The platform charts belong to the platform team; the programs summary and
  // the survey tiles are shown to whoever runs programs, for their own.
  const platformView = !isProgramAdmin(user?.role);
  const { data, isLoading, isError, refetch } = useGetAdminDashboardQuery(
    undefined,
    { skip: !platformView }
  );
  const { data: programStats, refetch: refetchPrograms } =
    useGetProgramDashboardQuery();
  const { data: pasStats, refetch: refetchPas } = usePasSubmissionStatsQuery();

  useLiveData(["submissions", "enrollments", "dashboard"], () => {
    if (platformView) refetch();
    void refetchPrograms();
  });
  useLiveData(["program_admin_survey"], refetchPas);

  const kpis = data?.kpis;
  // The same charts for everyone, drawn from their own figures.
  const acreageEnrolled =
    (platformView ? data?.acreageEnrolled : programStats?.acreageEnrolled) ?? [];
  const programSplit =
    (platformView ? data?.programSplit : programStats?.programSplit) ?? [];
  const assessmentTrends =
    (platformView ? data?.assessmentTrends : programStats?.assessmentTrends) ?? [];
  const rhiByProgram = data?.rhiByProgram ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, <span className="text-primary">{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Dashboards &amp; Analytics. Program metrics at a glance.
          </p>
        </div>
        {platformView && (
          <button
            type="button"
            disabled={!data || isLoading}
            onClick={() => {
              if (!data) return;
              void exportDashboard(data)
                .then(() => showSuccess("Report downloaded."))
                .catch(() => showError("Could not generate the report."));
            }}
            className="btn-primary self-start disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
          >
            <FileIcon width={18} height={18} />
            Export report
          </button>
        )}
      </div>

      {isLoading ? (
        <Loader message="Loading dashboard..." />
      ) : isError ? (
        <div className="card px-5 py-16 text-center">
          <p className="text-sm text-gray-500">
            Could not load dashboard data.
          </p>
          <button onClick={() => refetch()} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      ) : (
        <>
          {platformView && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Acreage enrolled"
              value={`${nfmt.format(kpis?.enrolledAcreage ?? 0)} ac`}
              Icon={LeafIcon}
              color="primary"
            />
            <StatCard
              label="Farms enrolled"
              value={nfmt.format(kpis?.farmsEnrolled ?? 0)}
              Icon={FarmIcon}
              color="secondary"
            />
            <StatCard
              label="Assessment completion"
              value={
                kpis?.completionPct == null ? "-" : `${kpis.completionPct}%`
              }
              Icon={ChartIcon}
              color="info"
            />
            <StatCard
              label="Avg. RHI score"
              value={kpis?.avgRhi == null ? "-" : `${kpis.avgRhi} / 100`}
              Icon={UsersIcon}
              color="accent"
            />
          </div>

          )}

          {/* Producers who applied through one of your surveys. */}
          <div className="card p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Survey submissions
                </h2>
                <p className="text-sm text-gray-500">
                  Producers who applied through one of your surveys.
                </p>
              </div>
              <Link
                to="/survey-submissions"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all submissions
              </Link>
            </div>
            <div className="mt-4">
              <ProgramSubmissionCards
                stats={pasStats}
                onPick={(status) =>
                  navigate(
                    status
                      ? `/survey-submissions?status=${status}`
                      : "/survey-submissions"
                  )
                }
              />
            </div>
          </div>

          {/* Programs, and how far their farmers have got. */}
          <div className="card p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Programs</h2>
                <p className="text-sm text-gray-500">
                  Enrollment and assessment progress across your programs.
                </p>
              </div>
              <Link
                to="/programs"
                className="text-sm font-medium text-primary hover:underline"
              >
                View programs
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              {PROGRAM_TILES.map((tile) => (
                <div key={tile.label} className="card p-5">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-xl ${tile.wrap}`}
                  >
                    <tile.Icon width={20} height={20} />
                  </span>
                  <p className="mt-3 text-2xl font-extrabold text-gray-900">
                    {nfmt.format(programStats?.[tile.key] ?? 0)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-700">
                    {tile.label}
                  </p>
                  <p className="text-xs text-gray-500">{tile.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Acreage enrolled
                  </h2>
                  <p className="text-sm text-gray-500">
                    Cumulative acres across all programs
                  </p>
                </div>
              </div>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={acreageEnrolled}
                    margin={{ top: 5, right: 10, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="acreage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#136F3F" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#136F3F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #DEE2E6",
                        fontSize: 13,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acres"
                      stroke="#136F3F"
                      strokeWidth={2.5}
                      fill="url(#acreage)"
                      name="Acres"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">
                Enrollment by program
              </h2>
              <p className="text-sm text-gray-500">Share of total acreage</p>
              {programSplit.length === 0 ? (
                <div className="grid h-56 place-items-center text-sm text-gray-500">
                  No enrolled acreage yet
                </div>
              ) : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={programSplit}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {programSplit.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #DEE2E6",
                            fontSize: 13,
                          }}
                          formatter={(v: number) => `${v}%`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {programSplit.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="flex items-center gap-2 text-gray-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </span>
                        <span className="font-semibold text-gray-900">{p.value}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">
                Assessment submissions &amp; score trends
              </h2>
              <p className="text-sm text-gray-500">
                Monthly submissions vs avg score
              </p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={assessmentTrends}
                    margin={{ top: 5, right: 10, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #DEE2E6",
                        fontSize: 13,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line
                      type="monotone"
                      dataKey="completion"
                      stroke="#207DD2"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      name="Submissions"
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#F5A623"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      name="Avg score"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {platformView && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">
                RHI benchmarking by program
              </h2>
              <p className="text-sm text-gray-500">
                Regenerative Health Index (0-100)
              </p>
              {rhiByProgram.length === 0 ? (
                <div className="grid h-64 place-items-center text-sm text-gray-500">
                  No assessments submitted yet
                </div>
              ) : (
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rhiByProgram}
                      margin={{ top: 5, right: 10, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="region" tick={axisStyle} axisLine={false} tickLine={false} />
                      <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip
                        cursor={{ fill: "#F5F7F9" }}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #DEE2E6",
                          fontSize: 13,
                        }}
                      />
                      <Bar dataKey="rhi" fill="#22A16A" radius={[6, 6, 0, 0]} name="RHI" maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            )}
          </div>
        </>
      )}

      {platformView && <LoginLogsTable />}
    </div>
  );
}
