import { useParams } from 'solito/navigation'
import InnerContestDetailScreen from './ContestDetailScreen'

// Wrapper component that extracts route param and passes to inner component
export default function ContestDetailScreen() {
  const params = useParams<{ id: string }>()

  return <InnerContestDetailScreen contestId={params.id} />
}
