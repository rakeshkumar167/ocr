import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface MonthlyData {
  month: string;
  total: number;
  count: number;
}

interface CategoryData {
  month: string;
  category: string;
  total: number;
  count: number;
}

interface StatsResponse {
  monthly: MonthlyData[];
  byCategory: CategoryData[];
}

interface Props {
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onBack: () => void;
}

const COLORS = [
  "#4f63e7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7",
];

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function Dashboard({ authedFetch }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await authedFetch("/api/invoices/stats");
        if (res.ok) {
          const data: StatsResponse = await res.json();
          setStats(data);
          setSelectedMonths(new Set(data.monthly.map((m) => m.month)));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [authedFetch]);

  const availableMonths = useMemo(() => stats?.monthly.map((m) => m.month) ?? [], [stats]);

  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const selectAll = () => setSelectedMonths(new Set(availableMonths));
  const selectNone = () => setSelectedMonths(new Set());

  const barData = useMemo(
    () => stats?.monthly.filter((m) => selectedMonths.has(m.month)).map((m) => ({
      ...m,
      label: formatMonth(m.month),
    })) ?? [],
    [stats, selectedMonths]
  );

  const pieData = useMemo(() => {
    if (!stats) return [];
    const categoryTotals = new Map<string, number>();
    for (const row of stats.byCategory) {
      if (!selectedMonths.has(row.month)) continue;
      categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.total);
    }
    return Array.from(categoryTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [stats, selectedMonths]);

  const totalSpend = useMemo(() => barData.reduce((sum, d) => sum + d.total, 0), [barData]);
  const totalInvoices = useMemo(() => barData.reduce((sum, d) => sum + d.count, 0), [barData]);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading"><div className="spinner" /></div>
      </div>
    );
  }

  if (!stats || stats.monthly.length === 0) {
    return (
      <div className="dashboard-container">
        <p className="dash-no-data">No invoice data available yet. Analyze some invoices to see charts.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Summary Stats */}
      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <span className="dash-stat-label">Total Spend</span>
          <span className="dash-stat-value">${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">Invoices</span>
          <span className="dash-stat-value">{totalInvoices}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">Categories</span>
          <span className="dash-stat-value">{pieData.length}</span>
        </div>
      </div>

      {/* Month Selector */}
      <div className="dash-month-selector">
        <span className="dash-month-label">Filter by Month</span>
        <div className="dash-month-actions">
          <button className="dash-month-action" onClick={selectAll}>All</button>
          <button className="dash-month-action" onClick={selectNone}>None</button>
        </div>
        <div className="dash-month-chips">
          {availableMonths.map((m) => (
            <button
              key={m}
              className={`dash-month-chip ${selectedMonths.has(m) ? "active" : ""}`}
              onClick={() => toggleMonth(m)}
            >
              {formatMonth(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="dash-charts">
        <div className="dash-chart-card">
          <h4>Monthly Spend</h4>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaef" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "Inter" }} stroke="#a0a5b5" />
                <YAxis tick={{ fontSize: 11, fontFamily: "Inter" }} stroke="#a0a5b5" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Total"]}
                  contentStyle={{ fontFamily: "Inter", fontSize: "13px", borderRadius: "8px", border: "1px solid #e8eaef", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                />
                <Bar dataKey="total" fill="#4f63e7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="dash-no-data">Select months to view data</p>
          )}
        </div>

        <div className="dash-chart-card">
          <h4>Spend by Category</h4>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={true}
                  strokeWidth={2}
                  stroke="#ffffff"
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Spend"]}
                  contentStyle={{ fontFamily: "Inter", fontSize: "13px", borderRadius: "8px", border: "1px solid #e8eaef", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                />
                <Legend
                  wrapperStyle={{ fontFamily: "Inter", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="dash-no-data">No category data for selected months</p>
          )}
        </div>
      </div>
    </div>
  );
}
