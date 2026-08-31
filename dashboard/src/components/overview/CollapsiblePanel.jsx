import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export default function CollapsiblePanel({ title, children, className = '' }) {
  const [expanded, setExpanded] = useState(true)
  const action = `${expanded ? '收合' : '展開'}${title}`

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card role="region" aria-label={title} className={`panel-card collapsible-panel ${className}`}>
        <CardHeader className="collapsible-panel-header">
          <CollapsibleTrigger
            render={<Button variant="ghost" />}
            className="collapsible-panel-toggle"
            aria-label={action}
          >
            <span>{title}</span>
            <ChevronDown size={18} className={expanded ? '' : 'collapsed'} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="collapsible-panel-body">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

