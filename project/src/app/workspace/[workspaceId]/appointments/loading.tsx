import { ListPageSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return <ListPageSkeleton action selects={3} columns={6} pagination />
}
