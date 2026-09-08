import { useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function StudentProfileSelectField({
  id, label, name, value, options, onChange, required = false, disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const items = [
    { value: null, label: '請選擇' },
    ...options.map(option => ({ value: option, label: option })),
  ]

  const handleKeyDown = event => {
    if (!open) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === 'Tab' && !event.currentTarget.contains(event.target)) {
      // Portal 內的 Tab 由 Select 處理，不進入自製詳情視窗的焦點迴圈。
      event.stopPropagation()
    }
  }

  return <div className="form-group" onKeyDown={handleKeyDown}>
    <Label htmlFor={id}>{label}</Label>
    <Select
      name={name}
      items={items}
      value={value || null}
      required={required}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
      onValueChange={nextValue => onChange({ target: { name, value: nextValue ?? '' } })}
    >
      <SelectTrigger ref={triggerRef} id={id} className="w-full">
        <SelectValue placeholder="請選擇" />
      </SelectTrigger>
      <SelectContent positionerClassName="z-[105]" alignItemWithTrigger={false}>
        {items.map(item => <SelectItem key={item.value ?? 'empty'} value={item.value}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
}
