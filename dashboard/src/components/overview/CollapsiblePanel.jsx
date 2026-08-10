import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CollapsiblePanel({ title, children, className = '' }) {
  const [expanded, setExpanded] = useState(true)
  const action = `${expanded ? '收合' : '展開'}${title}`

  return (
    <section className={`panel-card collapsible-panel ${className}`}>
      <button type="button" className="collapsible-panel-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={action}>
        <span>{title}</span>
        <ChevronDown size={18} className={expanded ? '' : 'collapsed'} />
      </button>
      {expanded && <div className="collapsible-panel-body">{children}</div>}
    </section>
  )
}
