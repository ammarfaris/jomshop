import ContestsListScreen from './ContestsListScreen'

interface ContestListScreenProps {
  hideTopPadding?: boolean
}

export default function ContestListScreen({
  hideTopPadding = false,
}: ContestListScreenProps) {
  return <ContestsListScreen hideTopPadding={hideTopPadding} />
}
