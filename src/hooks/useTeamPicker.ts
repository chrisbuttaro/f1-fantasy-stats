import { useState, useCallback } from 'react'
import type { Participant } from '../types'

interface TeamPicker {
  pickedDriverIds: string[]
  pickedConstructorIds: string[]
  pickedDrivers: Participant[]
  pickedConstructors: Participant[]
  budgetInput: string
  setBudgetInput: (v: string) => void
  budget: number
  totalCost: number
  remainingBudget: number | null  // null when no budget set
  toggleDriverPick: (e: React.MouseEvent, playerId: string) => void
  toggleConstructorPick: (e: React.MouseEvent, playerId: string) => void
}

// Manages team selection (max 5 drivers, max 2 constructors) and budget tracking.
export function useTeamPicker(drivers: Participant[], constructors: Participant[]): TeamPicker {
  const [pickedDriverIds, setPickedDriverIds] = useState<string[]>([])
  const [pickedConstructorIds, setPickedConstructorIds] = useState<string[]>([])
  const [budgetInput, setBudgetInput] = useState('')

  const budget = parseFloat(budgetInput) || 0

  // Resolve full Participant objects from ids — used in the team bar chips
  const pickedDrivers = pickedDriverIds.map(id => drivers.find(d => d.playerid === id)).filter(Boolean) as Participant[]
  const pickedConstructors = pickedConstructorIds.map(id => constructors.find(c => c.playerid === id)).filter(Boolean) as Participant[]
  const totalCost = [...pickedDrivers, ...pickedConstructors].reduce((sum, p) => sum + p.curvalue, 0)
  const remainingBudget = budget > 0 ? budget - totalCost : null

  const toggleDriverPick = useCallback((e: React.MouseEvent, playerId: string) => {
    e.stopPropagation()
    if (pickedDriverIds.includes(playerId)) {
      setPickedDriverIds(prev => prev.filter(id => id !== playerId))
      return
    }
    if (pickedDriverIds.length >= 5) return
    if (budget > 0) {
      const player = drivers.find(d => d.playerid === playerId)
      if (player && totalCost + player.curvalue > budget) return
    }
    setPickedDriverIds(prev => [...prev, playerId])
  }, [pickedDriverIds, budget, drivers, totalCost])

  const toggleConstructorPick = useCallback((e: React.MouseEvent, playerId: string) => {
    e.stopPropagation()
    if (pickedConstructorIds.includes(playerId)) {
      setPickedConstructorIds(prev => prev.filter(id => id !== playerId))
      return
    }
    if (pickedConstructorIds.length >= 2) return
    if (budget > 0) {
      const player = constructors.find(c => c.playerid === playerId)
      if (player && totalCost + player.curvalue > budget) return
    }
    setPickedConstructorIds(prev => [...prev, playerId])
  }, [pickedConstructorIds, budget, constructors, totalCost])

  return {
    pickedDriverIds, pickedConstructorIds,
    pickedDrivers, pickedConstructors,
    budgetInput, setBudgetInput,
    budget, totalCost, remainingBudget,
    toggleDriverPick, toggleConstructorPick,
  }
}
