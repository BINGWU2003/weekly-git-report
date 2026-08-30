import { createFileRoute } from '@tanstack/react-router'
import { Reports, type ReportSearchPatch } from '@/features/reports'
import { parseReportSearch } from '@/features/reports/report-library'

export const Route = createFileRoute('/_authenticated/reports/')({
  validateSearch: parseReportSearch,
  component: ReportsRoute,
})

function ReportsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  function updateSearch(patch: ReportSearchPatch) {
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, ...patch }),
    })
  }

  return <Reports routeSearch={search} onSearchChange={updateSearch} />
}
