import { useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { formatDateTime } from '#/lib/format'
import type { CommentRow, SettingsRow } from '#/lib/database.types'

interface CommentsSectionProps {
  comments: Array<CommentRow>
  settings: SettingsRow
  onAdd: (body: string) => void
  onDelete: (id: string) => void
}

export function CommentsSection({
  comments,
  settings,
  onAdd,
  onDelete,
}: CommentsSectionProps) {
  const [body, setBody] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setBody('')
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {comments.map((comment) => (
          <li
            key={comment.id}
            className="group flex items-start gap-2 rounded-md border bg-background px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatDateTime(comment.created_at, settings.locale)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive"
              onClick={() => onDelete(comment.id)}
              title="Opmerking verwijderen"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="flex items-end gap-2">
        <Textarea
          rows={1}
          value={body}
          placeholder="Opmerking toevoegen…"
          className="min-h-9 resize-none py-2"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit(event)
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!body.trim()}
          title="Toevoegen"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
