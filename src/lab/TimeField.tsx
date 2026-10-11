const MINUTES_PER_DAY = 1440
const MAX_MINUTES = 10080
const days = Array.from({ length: 8 }, (_, day) => day)

function clampMinutes(value: number) {
  return Math.min(MAX_MINUTES, Math.max(0, Number.isFinite(value) ? value : 0))
}

export function minutesToClock(value: number) {
  const minutes = clampMinutes(value)
  const day = Math.floor(minutes / MINUTES_PER_DAY)
  const milliseconds = Math.min(86399999, Math.round((minutes % MINUTES_PER_DAY) * 60000))
  const pad = (part: number) => String(part).padStart(2, '0')
  const hours = Math.floor(milliseconds / 3600000)
  const remainingMinutes = Math.floor((milliseconds % 3600000) / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const fraction = milliseconds % 1000
  let time = `${pad(hours)}:${pad(remainingMinutes)}`
  if (seconds || fraction) {
    time += `:${pad(seconds)}`
    if (fraction) time += `.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`
  }
  return { day, time }
}

export function clockToMinutes(time: string, day = 0): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/.exec(time)
  if (!match || !Number.isInteger(day) || day < 0 || day > 7) return null
  const seconds = Number(match[3] ?? 0) + Number(`0.${match[4] ?? '0'}`)
  return clampMinutes(
    day * MINUTES_PER_DAY + Number(match[1]) * 60 + Number(match[2]) + seconds / 60,
  )
}

export default function TimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (minutes: number) => void
}) {
  const { day, time } = minutesToClock(value)
  return (
    <div className="time-field">
      <label>
        {label}
        <input
          type="time"
          min="00:00"
          max={day === 7 ? '00:00' : undefined}
          step="any"
          value={time}
          onChange={(event) => {
            const minutes = clockToMinutes(event.target.value, day)
            if (minutes != null) onChange(minutes)
          }}
        />
      </label>
      <details className="time-day">
        <summary>Day {day + 1}</summary>
        <select
          aria-label={`${label} day`}
          value={day}
          onChange={(event) =>
            onChange(
              clampMinutes(
                Number(event.target.value) * MINUTES_PER_DAY +
                  (clampMinutes(value) % MINUTES_PER_DAY),
              ),
            )
          }
        >
          {days.map((index) => (
            <option key={index} value={index}>
              Day {index + 1}
            </option>
          ))}
        </select>
      </details>
    </div>
  )
}
