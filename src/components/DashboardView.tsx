import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { ActiveTab, AnalyticsSummary } from '../types';
import { getStatusPresentation } from '../utils/formatters';

interface DashboardViewProps {
  onNavigateTab: (tab: ActiveTab) => void;
  onInspectDoctor: (doctorId: string) => void;
  refreshSignal: number;
}

export function DashboardView({
  onNavigateTab,
  onInspectDoctor,
  refreshSignal,
}: DashboardViewProps) {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredDateIdx, setHoveredDateIdx] = useState<number | null>(null);
  const [hoveredDoctorId, setHoveredDoctorId] = useState<string | null>(null);

  const loadAnalytics = async (selectedRange: '7d' | '30d' | '90d' | 'all') => {
    setLoading(true);
    setError('');
    try {
      const res = await api.analytics.get(selectedRange);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics(range);
  }, [range, refreshSignal]);

  const maxDateValue = useMemo(() => {
    if (!data) return 4;
    let maxVal = 1;
    for (const pt of data.dateSeries) {
      if (pt.patients > maxVal) maxVal = pt.patients;
      if (pt.doctors > maxVal) maxVal = pt.doctors;
    }
    return Math.max(2, maxVal);
  }, [data]);

  const maxDoctorPatients = useMemo(() => {
    if (!data || data.patientsPerDoctor.length === 0) return 1;
    return Math.max(1, ...data.patientsPerDoctor.map((d) => d.patientCount));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-4 h-7 w-16 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
          <div className="lg:col-span-5 h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => loadAnalytics(range)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { totals, patientsPerDoctor, dateSeries, conditionBreakdown, statusBreakdown } = data;

  // Compute SVG line coordinates for Date-Based Statistics
  const chartW = 680;
  const chartH = 210;
  const padL = 32;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const stepX = dateSeries.length > 1 ? innerW / (dateSeries.length - 1) : innerW;

  const patientPoints = dateSeries
    .map((pt, idx) => {
      const x = padL + idx * stepX;
      const y = padT + innerH - (pt.patients / maxDateValue) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const patientArea = dateSeries.length > 0
    ? `M ${padL},${padT + innerH} L ${patientPoints.replace(/ /g, ' L ')} L ${padL + (dateSeries.length - 1) * stepX},${padT + innerH} Z`
    : '';

  const doctorPoints = dateSeries
    .map((pt, idx) => {
      const x = padL + idx * stepX;
      const y = padT + innerH - (pt.doctors / maxDateValue) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const hoveredPoint = hoveredDateIdx !== null ? dateSeries[hoveredDateIdx] : null;
  const labelStride = Math.max(1, Math.ceil(dateSeries.length / 6));

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section aria-label="Key clinical metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Doctors</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {totals.totalDoctors}
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            +{totals.recentDoctors30d} onboarded in last 30d
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Patients</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {totals.totalPatients}
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            +{totals.recentPatients7d} admitted in last 7d
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Avg Patients / Doctor</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {totals.avgPatientsPerDoctor.toFixed(1)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Balanced across {data.facets.specializations.length} specialties
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Critical Attention</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-red-700 tabular-nums">
            {totals.activeCriticalCases}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Active critical patient cases
          </p>
        </div>
      </section>

      {/* Primary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Date-Based Statistics Chart */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Date-Based Intake & Onboarding
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Daily patient admissions and doctor additions across selected window
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Time range">
              {(['7d', '30d', '90d', 'all'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRange(opt)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors whitespace-nowrap shrink-0 ${
                    range === opt
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-2 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-700" />
                Patient Admissions
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-900" />
                Doctors Added
              </span>
            </div>
            <div className="h-5 font-mono text-xs text-slate-600 tabular-nums">
              {hoveredPoint ? (
                <span>
                  {hoveredPoint.label}: <strong>{hoveredPoint.patients}</strong> patients ·{' '}
                  <strong>{hoveredPoint.doctors}</strong> doctors
                </span>
              ) : (
                <span className="text-slate-400">Hover chart points to inspect</span>
              )}
            </div>
          </div>

          <div className="mt-3 w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-56 select-none"
              role="img"
              aria-label="Date-based patient admissions and doctor onboarding chart"
              onMouseLeave={() => setHoveredDateIdx(null)}
            >
              <defs>
                <linearGradient id="dtAreaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines */}
              {[0, 0.5, 1].map((frac, idx) => {
                const y = padT + innerH - frac * innerH;
                const val = Math.round(frac * maxDateValue);
                return (
                  <g key={idx}>
                    <line
                      x1={padL}
                      x2={chartW - padR}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray={idx === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padL - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Area and lines */}
              {patientArea && <path d={patientArea} fill="url(#dtAreaGrad)" />}
              {patientPoints && (
                <polyline
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={patientPoints}
                />
              )}
              {doctorPoints && (
                <polyline
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={doctorPoints}
                />
              )}

              {/* X axis ticks and interactive columns */}
              {dateSeries.map((pt, idx) => {
                const x = padL + idx * stepX;
                const yPat = padT + innerH - (pt.patients / maxDateValue) * innerH;
                const yDoc = padT + innerH - (pt.doctors / maxDateValue) * innerH;
                const isHovered = hoveredDateIdx === idx;
                const showTick = idx % labelStride === 0 || idx === dateSeries.length - 1;

                return (
                  <g key={pt.date}>
                    {showTick && (
                      <text
                        x={x}
                        y={chartH - 8}
                        textAnchor="middle"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {pt.label}
                      </text>
                    )}

                    {isHovered && (
                      <line
                        x1={x}
                        x2={x}
                        y1={padT}
                        y2={padT + innerH}
                        stroke="#94a3b8"
                        strokeWidth="1"
                      />
                    )}

                    {(pt.patients > 0 || isHovered) && (
                      <circle
                        cx={x}
                        cy={yPat}
                        r={isHovered ? 4.5 : 3}
                        fill="#0f766e"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}

                    {(pt.doctors > 0 || isHovered) && (
                      <circle
                        cx={x}
                        cy={yDoc}
                        r={isHovered ? 4 : 2.5}
                        fill="#0f172a"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                    )}

                    <rect
                      x={x - Math.max(8, stepX / 2)}
                      y={padT}
                      width={Math.max(16, stepX)}
                      height={innerH}
                      fill="transparent"
                      onMouseEnter={() => setHoveredDateIdx(idx)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Patients Per Doctor Distribution */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Patients per Doctor
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Active caseload distribution (click a doctor to inspect patients)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('doctors')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              <span>All Doctors</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-5 space-y-3 flex-1 overflow-y-auto max-h-72 pr-1">
            {patientsPerDoctor.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No doctors recorded yet.</p>
            ) : (
              patientsPerDoctor.map((doc) => {
                const widthPct = Math.round((doc.patientCount / maxDoctorPatients) * 100);
                const isHovered = hoveredDoctorId === doc.doctorId;
                return (
                  <button
                    key={doc.doctorId}
                    type="button"
                    onClick={() => onInspectDoctor(doc.doctorId)}
                    onMouseEnter={() => setHoveredDoctorId(doc.doctorId)}
                    onMouseLeave={() => setHoveredDoctorId(null)}
                    className="w-full text-left group rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-800 truncate group-hover:text-teal-800">
                        {doc.doctorName}
                      </span>
                      <span className="font-mono text-slate-600 tabular-nums shrink-0">
                        {doc.patientCount} {doc.patientCount === 1 ? 'patient' : 'patients'}
                        {doc.criticalCount > 0 ? ` · ${doc.criticalCount} critical` : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          isHovered ? 'bg-teal-600' : 'bg-teal-700'
                        }`}
                        style={{ width: `${Math.max(widthPct, doc.patientCount > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Secondary Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Medical Conditions */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Patient Condition Breakdown
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Most prevalent clinical diagnoses across active patient records
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('patients')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              <span>All Patients</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {conditionBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No patient conditions logged yet.</p>
            ) : (
              conditionBreakdown.map((item) => (
                <div key={item.condition} className="py-2.5 flex items-center gap-4">
                  <span className="w-44 truncate text-sm font-medium text-slate-800">
                    {item.condition}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-800"
                      style={{ width: `${Math.max(item.percentage, 6)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono text-xs text-slate-600 tabular-nums shrink-0">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Clinical Status Distribution */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Clinical Status Summary
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Current patient acuity distribution
          </p>

          <div className="mt-5 space-y-4">
            {statusBreakdown.map((item) => {
              const pres = getStatusPresentation(item.status);
              const pct = totals.totalPatients > 0
                ? Math.round((item.count / totals.totalPatients) * 100)
                : 0;
              return (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${pres.textClass}`}>{item.status}</span>
                    <span className="font-mono text-xs text-slate-600 tabular-nums">
                      {item.count} patients · {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pres.dotClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
