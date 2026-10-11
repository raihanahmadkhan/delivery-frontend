import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TimeField, { clockToMinutes, minutesToClock } from './TimeField'

describe('route time conversion', () => {
  it('stores clock times as minutes from the start of the route', () => {
    expect(clockToMinutes('08:00')).toBe(480)
    expect(clockToMinutes('18:00')).toBe(1080)
    expect(minutesToClock(480)).toEqual({ day: 0, time: '08:00' })
  })

  it('round-trips times across multiple route days', () => {
    for (const minutes of [0, 1439, 1440, 1920, 9720, 10080]) {
      const { time, day } = minutesToClock(minutes)
      expect(clockToMinutes(time, day)).toBe(minutes)
    }
    expect(minutesToClock(1920)).toEqual({ day: 1, time: '08:00' })
    expect(minutesToClock(10080)).toEqual({ day: 7, time: '00:00' })
  })

  it('retains fractional benchmark minutes through seconds and milliseconds', () => {
    expect(minutesToClock(480.5)).toEqual({ day: 0, time: '08:00:30' })
    expect(clockToMinutes('08:00:30')).toBe(480.5)
    const { time, day } = minutesToClock(1920.501)
    expect(time).toBe('08:00:30.06')
    expect(clockToMinutes(time, day)).toBeCloseTo(1920.501, 8)
  })

  it('keeps the seven-day horizon and rejects incomplete clock entries', () => {
    expect(clockToMinutes('08:00', 7)).toBe(10080)
    expect(minutesToClock(-5)).toEqual({ day: 0, time: '00:00' })
    expect(minutesToClock(10081)).toEqual({ day: 7, time: '00:00' })
    for (const time of ['', '8:00', '24:00', '08:60', '08:00:60']) {
      expect(clockToMinutes(time)).toBeNull()
    }
  })
})

describe('route time entry', () => {
  it('converts an accessible clock input to backend minutes', () => {
    const onChange = vi.fn()
    render(<TimeField label="Shift start" value={0} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Shift start'), { target: { value: '08:00' } })
    expect(onChange).toHaveBeenCalledWith(480)
  })

  it('preserves fractional minutes when only the route day changes', () => {
    const onChange = vi.fn()
    render(<TimeField label="Window start" value={480.123456} onChange={onChange} />)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Day 1', { selector: 'summary' }))
    fireEvent.change(screen.getByLabelText('Window start day'), { target: { value: '1' } })
    expect(onChange).toHaveBeenCalledWith(1920.123456)
  })

  it('limits the last route day to midnight', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TimeField label="Shift end" value={1080} onChange={onChange} />)
    fireEvent.click(screen.getByText('Day 1', { selector: 'summary' }))
    fireEvent.change(screen.getByLabelText('Shift end day'), { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith(10080)
    rerender(<TimeField label="Shift end" value={10080} onChange={onChange} />)
    const clock = screen.getByLabelText('Shift end') as HTMLInputElement
    expect(clock.value).toBe('00:00')
    expect(clock.max).toBe('00:00')
  })
})
