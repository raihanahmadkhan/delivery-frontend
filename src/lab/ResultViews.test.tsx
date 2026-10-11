import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExperimentView, Schedule } from './ResultViews'
import { newRoadScenario } from './state'
import type { Experiment, Result } from './types'

describe('result presentation', () => {
  it('shows the route day for schedules extending past midnight', () => {
    const result = {
      scenario: { ...newRoadScenario(), fleet: { ...newRoadScenario().fleet, end_time: 1920 } },
      evaluation: {
        violations: [],
        vehicles: [
          {
            vehicle_index: 0,
            customers: [],
            schedule: [],
            distance_km: 1,
            initial_load: 0,
            capacity: 30,
            return_time: 1920,
          },
        ],
      },
    } as unknown as Result
    render(<Schedule result={result} selected={null} onSelect={vi.fn()} focused={null} />)
    expect(screen.getByText(/back Day 2 08:00/)).toBeTruthy()
    expect(screen.queryByText(/32:00/)).toBeNull()
  })

  it('does not claim a zero runtime when no timing is available for a comparison', () => {
    const experiment: Experiment = {
      kind: 'experiment',
      scenario: newRoadScenario(),
      trials: [],
      completed_trials: 0,
      planned_trials: 1,
      total_time_ms: 0,
      methodology: 'Test comparison',
      summary: [
        {
          algorithm: 'alns',
          runs: 0,
          feasible_runs: 0,
          feasible_rate: 0,
          min_vehicles: null,
          max_vehicles: null,
          median_distance_at_min_vehicles: null,
          min_distance_at_min_vehicles: null,
          max_distance_at_min_vehicles: null,
          distance_stdev_at_min_vehicles: null,
          median_solver_ms: null,
        },
      ],
    }
    render(<ExperimentView experiment={experiment} onTrial={vi.fn()} />)
    expect(screen.queryByRole('cell', { name: '0.00s' })).toBeNull()
    expect(screen.getAllByRole('cell', { name: 'N/A' })).toHaveLength(3)
  })
})
