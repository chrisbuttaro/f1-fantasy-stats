export const TEAM_COLORS: Record<string, string> = {
  'Mercedes':         '#27F4D2',
  'Ferrari':          '#E8002D',
  'Red Bull Racing':  '#3671C6',
  'McLaren':          '#FF8000',
  'Alpine':           '#FF87BC',
  'Aston Martin':     '#229971',
  'Williams':         '#64C4FF',
  'Racing Bulls':     '#6692FF',
  'Haas F1 Team':     '#B6BABD',
  'Cadillac':         '#C8A84B',
  'Audi':             '#C0C0C0',
}

export function teamColor(teamname: string): string {
  return TEAM_COLORS[teamname] ?? '#71717a'
}
