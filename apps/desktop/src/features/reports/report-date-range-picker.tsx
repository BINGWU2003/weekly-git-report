import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'

export default function ReportDateRangePicker({
  range,
  onChange,
}: {
  range?: DateRange
  onChange(range: DateRange | undefined): void
}) {
  return (
    <Calendar
      mode='range'
      numberOfMonths={2}
      selected={range}
      onSelect={onChange}
      defaultMonth={range?.from}
    />
  )
}
