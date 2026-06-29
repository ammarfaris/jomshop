import { useRouteParams } from 'app/hooks/useRouteParams'
import InnerContestDetailScreen from './ContestDetailScreen'

// Wrapper component that extracts route param and passes to inner component
export default function ContestDetailScreen() {
  const params = useRouteParams<{ id: string }>()

  return <InnerContestDetailScreen contestId={params?.id} />
}
