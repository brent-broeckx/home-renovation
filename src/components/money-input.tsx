import { useEffect, useRef, useState } from 'react'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { parseAmountInput } from '#/lib/format'

interface MoneyInputProps {
  value: number
  onCommit: (value: number) => void
  id?: string
  className?: string
  placeholder?: string
  disabled?: boolean
}

/**
 * Amount field that keeps the raw text while typing and only writes a rounded
 * number on blur / Enter, so the value never jumps around under the cursor.
 */
export function MoneyInput({
  value,
  onCommit,
  id,
  className,
  placeholder,
  disabled,
}: MoneyInputProps) {
  const [draft, setDraft] = useState(() => (value ? String(value) : ''))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value ? String(value) : '')
  }, [value])

  function commit() {
    const parsed = parseAmountInput(draft)
    if (parsed !== value) onCommit(parsed)
    setDraft(parsed ? String(parsed) : '')
  }

  return (
    <Input
      id={id}
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder ?? '0,00'}
      className={cn('tabular text-right', className)}
      value={draft}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}
