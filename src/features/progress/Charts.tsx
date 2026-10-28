import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Chart conventions: one axis, thin bars with 4px rounded data-ends, recessive grid,
 * text in ink tokens (never series colour), hover tooltip, and a data-table toggle.
 * Series colours are validated tokens (--chart-*), not raw status colours.
 */

const axis = { stroke: 'var(--text-3)', fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-1.5 text-ink-2">
          {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}
          {r.label}: <span className="tnum font-semibold text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartFrame({ children, table, height = 200 }: { children: ReactNode; table: { head: string[]; rows: (string | number)[][] }; height?: number }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div>
      {showTable ? (
        <div className="max-h-[260px] overflow-auto rounded-lg border border-line">
          <table className="tnum w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-2 text-ink-3">
              <tr>
                {table.head.map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-1.5 text-ink-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} aria-hidden>
          {children}
        </div>
      )}
      <button type="button" className="mt-2 text-xs font-medium text-ink-3 hover:text-ink" onClick={() => setShowTable(!showTable)} aria-pressed={showTable}>
        {showTable ? 'Show chart' : 'Show data table'}
      </button>
      {!showTable && (
        <div className="sr-only">
        <table>
          <thead>
            <tr>
              {table.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

export interface PercentDatum {
  label: string;
  detail: string;
  /** 0–100, or null for "nothing planned". */
  value: number | null;
}

/** Single-series percent bars (habit adherence per day / per week). No legend: the title names it. */
export function PercentBars({ data, height = 200 }: { data: PercentDatum[]; height?: number }) {
  return (
    <ChartFrame height={height} table={{ head: ['Period', 'Completion', 'Detail'], rows: data.map((d) => [d.label, d.value === null ? '—' : `${d.value}%`, d.detail]) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, v: d.value ?? 0 }))} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as PercentDatum | undefined;
              if (!active || !d) return null;
              return <TooltipBox title={d.label} rows={[{ label: 'Completion', value: d.value === null ? 'nothing planned' : `${d.value}%`, color: 'var(--chart-single)' }, { label: 'Detail', value: d.detail }]} />;
            }}
          />
          <Bar dataKey="v" fill="var(--chart-single)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export interface CategoryDatum {
  category: string;
  completed: number;
  attempted: number;
  total: number;
}

/** Stacked horizontal bars: completed + attempted out of the category total. Legend + 2px gap between segments. */
export function CategoryBars({ data }: { data: CategoryDatum[] }) {
  const height = Math.max(160, data.length * 26 + 24);
  return (
    <div>
      <ul className="mb-2 flex gap-4 text-xs text-ink-2" aria-hidden>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--chart-done)' }} /> Completed
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--chart-attempt)' }} /> Attempted
        </li>
      </ul>
      <ChartFrame height={height} table={{ head: ['Category', 'Completed', 'Attempted', 'Total'], rows: data.map((d) => [d.category, d.completed, d.attempted, d.total]) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
            <XAxis type="number" allowDecimals={false} {...axis} domain={[0, Math.max(1, ...data.map((d) => d.total))]} />
            <YAxis type="category" dataKey="category" width={112} {...axis} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as CategoryDatum | undefined;
                if (!active || !d) return null;
                return (
                  <TooltipBox
                    title={d.category}
                    rows={[
                      { label: 'Completed', value: `${d.completed} of ${d.total}`, color: 'var(--chart-done)' },
                      { label: 'Attempted', value: `${d.attempted}`, color: 'var(--chart-attempt)' },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="completed" stackId="a" fill="var(--chart-done)" stroke="var(--surface)" strokeWidth={2} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="attempted" stackId="a" fill="var(--chart-attempt)" stroke="var(--surface)" strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

export interface PbDatum {
  label: string;
  pct: number;
  detail: string;
}

/** Personal-best improvements in %. Direct value labels; single series. */
export function PbBars({ data }: { data: PbDatum[] }) {
  const height = Math.max(120, data.length * 34 + 16);
  return (
    <ChartFrame height={height} table={{ head: ['Record', 'Improvement', 'Change'], rows: data.map((d) => [d.label, `+${d.pct}%`, d.detail]) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="label" width={150} {...axis} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as PbDatum | undefined;
              if (!active || !d) return null;
              return <TooltipBox title={d.label} rows={[{ label: 'Improvement', value: `+${d.pct}%`, color: 'var(--chart-done)' }, { label: 'Change', value: d.detail }]} />;
            }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} label={{ position: 'right', fill: 'var(--text-2)', fontSize: 11, formatter: (v: unknown) => `+${String(v)}%` }}>
            {data.map((d) => (
              <Cell key={d.label} fill="var(--chart-done)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
