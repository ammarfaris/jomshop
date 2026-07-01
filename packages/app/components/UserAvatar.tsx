import { Avatar, AvatarFallback } from 'app/components/ui/avatar'
import { Text } from 'app/components/ui/text'

interface UserAvatarProps {
  userId?: string
  displayName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

/**
 * Get initials from display name (up to first 3 words)
 */
function getInitials(displayName?: string): string {
  if (!displayName) return '?'

  const words = displayName.trim().split(/\s+/).slice(0, 3)
  return words.map((word) => word[0]?.toUpperCase() || '').join('')
}

/**
 * Get size classes based on size prop
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg' | 'xl'): string {
  switch (size) {
    case 'sm':
      return 'size-8'
    case 'md':
      return 'size-12'
    case 'lg':
      return 'size-16'
    case 'xl':
      return 'size-24'
    default:
      return 'size-12'
  }
}

/**
 * Get text size classes based on avatar size
 */
function getTextSizeClasses(size: 'sm' | 'md' | 'lg' | 'xl'): string {
  switch (size) {
    case 'sm':
      return 'text-xs'
    case 'md':
      return 'text-sm'
    case 'lg':
      return 'text-base'
    case 'xl':
      return 'text-xl'
    default:
      return 'text-sm'
  }
}

/**
 * User avatar showing the display-name initials. (Google avatar support can be
 * re-added later from the Supabase user metadata.)
 */
export function UserAvatar({
  displayName,
  size = 'md',
  className,
}: UserAvatarProps) {
  const initials = getInitials(displayName)
  const sizeClasses = getSizeClasses(size)
  const textSizeClasses = getTextSizeClasses(size)

  return (
    <Avatar
      alt={`${displayName || 'User'}'s Avatar`}
      className={`${sizeClasses} ${className || ''}`}
    >
      <AvatarFallback>
        <Text className={`font-semibold ${textSizeClasses}`}>{initials}</Text>
      </AvatarFallback>
    </Avatar>
  )
}
