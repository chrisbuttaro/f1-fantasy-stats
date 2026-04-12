import type { RaceStat } from '../types'

interface Bound {
  points: number
  name: string
}

interface RaceChartProps {
  stats: RaceStat[]
  color: string
  globalMax?: Bound
  globalMin?: Bound
}

// Pure SVG line chart showing fantasy points per race for one participant.
// globalMax/globalMin scale the y-axis to the best/worst single-race score across all participants.
export default function RaceChart({ stats, color, globalMax, globalMin }: RaceChartProps) {
  const W = 560, H = 160
  const pad = { top: 28, right: 110, bottom: 50, left: 44 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const n = stats.length

  const values = stats.map(s => s.points)
  const localMin = Math.min(...values)
  const localMax = Math.max(...values)

  // Expand y range to global bounds so all charts share the same scale
  const minV = globalMin ? Math.min(globalMin.points, localMin) : localMin
  const maxV = globalMax ? Math.max(globalMax.points, localMax) : localMax
  const allSame = minV === maxV

  const xOf = (i: number) => pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yOf = (v: number) => allSame
    ? pad.top + plotH / 2
    : pad.top + plotH - ((v - minV) / (maxV - minV)) * plotH

  const polylinePoints = stats.map((s, i) => `${xOf(i)},${yOf(s.points)}`).join(' ')

  // Use global bounds as named guide lines; fall back to local min/mid/max
  const guides: { v: number; y: number; label: string }[] = globalMax && globalMin
    ? [
        { v: globalMin.points, y: yOf(globalMin.points), label: globalMin.name },
        { v: globalMax.points, y: yOf(globalMax.points), label: globalMax.name },
      ]
    : allSame
      ? [{ v: minV, y: yOf(minV), label: '' }]
      : [
          { v: minV, y: yOf(minV), label: '' },
          { v: Math.round((minV + maxV) / 2), y: yOf((minV + maxV) / 2), label: '' },
          { v: maxV, y: yOf(maxV), label: '' },
        ]

  // Closed path that fills the area beneath the line
  const areaPath = n > 1
    ? `M ${xOf(0)},${yOf(stats[0].points)} ` +
      stats.slice(1).map((s, i) => `L ${xOf(i + 1)},${yOf(s.points)}`).join(' ') +
      ` L ${xOf(n - 1)},${pad.top + plotH} L ${xOf(0)},${pad.top + plotH} Z`
    : ''

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-label="Race points chart"
    >
      <defs>
        <linearGradient id={`area-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal guide lines — left label is the points value, right label is participant name */}
      {guides.map((g, i) => (
        <g key={i}>
          <line x1={pad.left} y1={g.y} x2={W - pad.right} y2={g.y} stroke="#2a2a3a" strokeWidth="1" />
          <text x={pad.left - 6} y={g.y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#71717a">
            {g.v}
          </text>
          {g.label && (
            <text x={W - pad.right + 6} y={g.y} textAnchor="start" dominantBaseline="middle" fontSize="9" fill="#71717a">
              {g.label}
            </text>
          )}
        </g>
      ))}

      {/* Gradient area fill */}
      {areaPath && <path d={areaPath} fill={`url(#area-grad-${color.replace('#', '')})`} />}

      {/* Line — only when 2+ data points */}
      {n > 1 && (
        <polyline points={polylinePoints} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Dot, halo, point value, and location label per race */}
      {stats.map((s, i) => (
        <g key={s.gamedayId}>
          <circle cx={xOf(i)} cy={yOf(s.points)} r="4" fill={color} />
          <circle cx={xOf(i)} cy={yOf(s.points)} r="7" fill={color} fillOpacity="0.15" />
          <text x={xOf(i)} y={yOf(s.points) - 12} textAnchor="middle" fontSize="10" fill="#e0e0e0" fontWeight="700">
            {s.points > 0 ? '+' : ''}{s.points}
          </text>
          <text x={xOf(i)} y={H - pad.bottom + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {s.location}
          </text>
        </g>
      ))}
    </svg>
  )
}
