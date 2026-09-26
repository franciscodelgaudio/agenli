import { HeadingSkeleton, OverviewSkeleton, PageSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return (
    <PageSkeleton>
      <HeadingSkeleton action />
      <OverviewSkeleton />
    </PageSkeleton>
  )
}
