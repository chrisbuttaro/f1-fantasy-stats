// Shared shape for both driver and constructor participants.
// For constructors, playername is null — use teamname as the display name.
export interface Participant {
  playerid: string
  playername: string | null  // null for constructors
  curvalue: number           // price in $m
  teamid: string
  teamname: string
  statvalue: number          // total fantasy points
  rnk: number
}

// Per-driver win odds for an upcoming race, sourced from The Odds API
export interface DriverOdds {
  name: string
  price: number            // American odds integer (e.g. 250, -200)
  formattedPrice: string   // "+250" or "-200"
  impliedProbability: number
}

export interface OddsData {
  raceName: string
  commenceTime: string
  bookmaker: string
  drivers: DriverOdds[]
}

// Per-race points built from GamedayWiseStats + FixtureWiseStats
export interface RaceStat {
  gamedayId: number
  meetingName: string
  location: string   // country name used as x-axis label
  points: number
}
