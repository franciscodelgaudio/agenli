import { ListPageSkeleton } from "@/components/page-skeletons"

export default function Loading() {
  return <ListPageSkeleton action selects={2} columns={4} avatar pagination />
}
