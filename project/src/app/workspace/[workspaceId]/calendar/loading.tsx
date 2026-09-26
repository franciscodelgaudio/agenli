import { CalendarHeadingSkeleton, CalendarSkeleton, PageSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton>
      <CalendarHeadingSkeleton />
      <CalendarSkeleton />
    </PageSkeleton>
  )
}
