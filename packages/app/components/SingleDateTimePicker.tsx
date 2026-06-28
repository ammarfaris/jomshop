// FOR WEB ONLY - it uses a web native date input <input type="datetime-local" /> for a better experience.

export default function SingleDateTimePicker({
  value,
  onChange,
  ...props
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}) {
  // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
  const getDateTimeLocalValue = (isoString: string): string => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch {
      return ''
    }
  }

  // Convert datetime-local format back to ISO string
  const handleDateTimeChange = (dateTimeLocal: string): void => {
    if (!dateTimeLocal) {
      onChange('')
      return
    }
    try {
      const date = new Date(dateTimeLocal)
      onChange(date.toISOString())
    } catch {
      onChange('')
    }
  }

  return (
    <input
      type="datetime-local"
      value={getDateTimeLocalValue(value)}
      onChange={(e) => handleDateTimeChange(e.target.value)}
      placeholder={props.placeholder ?? ''}
      style={{
        // width: '100%',
        height: 40,
        borderRadius: 6,
        border: '1px solid #ccc',
        padding: '0 12px',
        // fontSize: 16,
      }}
    />
  )
}
