import { HeadingSkeleton, PageSkeleton, TableSkeleton } from "@/components/page-skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <PageSkeleton>
      <HeadingSkeleton />
      <TableSkeleton columns={3} rows={12} />
      <Skeleton className="h-9 w-20" />
    </PageSkeleton>
  )
}
