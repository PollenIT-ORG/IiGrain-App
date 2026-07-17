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
import { useAuth } from "../store/useAuth";
import StatCard from "../components/dashboard/StatCard";
import LoginLogsTable from "../components/dashboard/LoginLogsTable";
import Loader from "../components/Loader";
import { FarmIcon, ChartIcon, UsersIcon, LeafIcon, FileIcon } from "../components/icons";
import { useGetAdminDashboardQuery } from "../store/endpoints/dashboardApi";
import { useLiveData } from "../lib/useLiveData";

const axisStyle = { fontSize: 12, fill: "#495057" };
const gridStroke = "#DEE2E6";

const nfmt = new Intl.NumberFormat("en-US");

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = (user?.fullName || "Admin").split(" ")[0];

  const { data, isLoading, isError, refetch } = useGetAdminDashboardQuery();

  useLiveData(["submissions", "enrollments", "dashboard"], refetch);

  const kpis = data?.kpis;
  const acreageEnrolled = data?.acreageEnrolled ?? [];
  const programSplit = data?.programSplit ?? [];
  const assessmentTrends = data?.assessmentTrends ?? [];
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
        <button className="btn-primary self-start sm:self-auto">
          <FileIcon width={18} height={18} />
          Export report
        </button>
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
          </div>
        </>
      )}

      <LoginLogsTable />
    </div>
  );
}
