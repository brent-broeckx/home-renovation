import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Flag, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  DEFAULT_SETTINGS,
  useDeleteTodo,
  useSaveTodo,
  useSettings,
  useTodos,
} from '#/lib/api'
import { daysUntil, formatDate } from '#/lib/format'
import { cn } from '#/lib/utils'
import type { TodoRow } from '#/lib/database.types'

export const Route = createFileRoute('/todos')({ component: TodosPage })

const PRIORITY_LABEL: Record<number, string> = {
  0: 'Laag',
  1: 'Normaal',
  2: 'Hoog',
}

function TodosPage() {
  const todosQuery = useTodos()
  const settingsQuery = useSettings()
  const saveTodo = useSaveTodo()
  const deleteTodo = useDeleteTodo()

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('1')
  const [showDone, setShowDone] = useState(true)

  const locale = settingsQuery.data?.locale ?? DEFAULT_SETTINGS.locale
  const todos = useMemo(() => todosQuery.data ?? [], [todosQuery.data])

  const { open, done } = useMemo(() => {
    const sorted = [...todos].sort(
      (a, b) =>
        b.priority - a.priority ||
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at),
    )
    return {
      open: sorted.filter((todo) => !todo.done),
      done: sorted.filter((todo) => todo.done),
    }
  }, [todos])

  function addTodo(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    saveTodo.mutate({
      title: trimmed,
      due_date: dueDate || null,
      priority: Number(priority),
      sort_order: todos.length,
    })
    setTitle('')
    setDueDate('')
    setPriority('1')
  }

  function move(todo: TodoRow, direction: -1 | 1) {
    const list = open
    const index = list.findIndex((row) => row.id === todo.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= list.length) return
    const target = list[targetIndex]
    saveTodo.mutate({
      id: todo.id,
      title: todo.title,
      sort_order: target.sort_order,
    })
    saveTodo.mutate({
      id: target.id,
      title: target.title,
      sort_order: todo.sort_order,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">To-do&apos;s</h1>
        <p className="text-sm text-muted-foreground">
          Alles wat nog geregeld moet worden voor de verbouwing.
        </p>
      </div>

      <Card>
        <CardContent className="py-3">
          <form
            onSubmit={addTodo}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nieuwe to-do…"
              className="min-w-[12rem] flex-1"
            />
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-[10rem]"
            />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[8rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Hoog</SelectItem>
                <SelectItem value="1">Normaal</SelectItem>
                <SelectItem value="0">Laag</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!title.trim()}>
              <Plus className="size-4" />
              Toevoegen
            </Button>
          </form>
        </CardContent>
      </Card>

      {todosQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="py-2">
              {open.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Niets meer te doen.
                </p>
              ) : (
                <ul className="divide-y">
                  {open.map((todo, index) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      locale={locale}
                      canMoveUp={index > 0}
                      canMoveDown={index < open.length - 1}
                      onMove={(direction) => move(todo, direction)}
                      onToggle={(value) =>
                        saveTodo.mutate({
                          id: todo.id,
                          title: todo.title,
                          done: value,
                          completed_at: value ? new Date().toISOString() : null,
                        })
                      }
                      onRename={(value) =>
                        saveTodo.mutate({ id: todo.id, title: value })
                      }
                      onDueDate={(value) =>
                        saveTodo.mutate({
                          id: todo.id,
                          title: todo.title,
                          due_date: value,
                        })
                      }
                      onDelete={() => deleteTodo.mutate(todo.id)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {done.length > 0 ? (
            <Card>
              <CardContent className="py-2">
                <button
                  type="button"
                  className="w-full py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowDone((value) => !value)}
                >
                  Afgewerkt ({done.length}) {showDone ? '−' : '+'}
                </button>
                {showDone ? (
                  <ul className="divide-y">
                    {done.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        locale={locale}
                        canMoveUp={false}
                        canMoveDown={false}
                        onMove={() => undefined}
                        onToggle={(value) =>
                          saveTodo.mutate({
                            id: todo.id,
                            title: todo.title,
                            done: value,
                            completed_at: value
                              ? new Date().toISOString()
                              : null,
                          })
                        }
                        onRename={(value) =>
                          saveTodo.mutate({ id: todo.id, title: value })
                        }
                        onDueDate={(value) =>
                          saveTodo.mutate({
                            id: todo.id,
                            title: todo.title,
                            due_date: value,
                          })
                        }
                        onDelete={() => deleteTodo.mutate(todo.id)}
                      />
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

function TodoItem({
  todo,
  locale,
  canMoveUp,
  canMoveDown,
  onMove,
  onToggle,
  onRename,
  onDueDate,
  onDelete,
}: {
  todo: TodoRow
  locale: string
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (direction: -1 | 1) => void
  onToggle: (value: boolean) => void
  onRename: (value: string) => void
  onDueDate: (value: string | null) => void
  onDelete: () => void
}) {
  const days = daysUntil(todo.due_date)

  return (
    <li className="group flex items-center gap-2 py-2">
      <Checkbox
        checked={todo.done}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={todo.title}
      />

      <input
        className={cn(
          'min-w-0 flex-1 truncate bg-transparent text-sm outline-none focus:underline',
          todo.done && 'text-muted-foreground line-through',
        )}
        defaultValue={todo.title}
        onBlur={(event) => {
          const value = event.target.value.trim()
          if (value && value !== todo.title) onRename(value)
          else event.target.value = todo.title
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />

      {todo.priority !== 1 ? (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 gap-1 text-[10px]',
            todo.priority === 2 ? 'border-red-300 bg-red-50 text-red-700' : '',
          )}
        >
          <Flag className="size-3" />
          {PRIORITY_LABEL[todo.priority]}
        </Badge>
      ) : null}

      {todo.due_date ? (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-[10px]',
            !todo.done && days !== null && days < 0
              ? 'border-red-300 bg-red-50 text-red-700'
              : !todo.done && days !== null && days <= 7
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'text-muted-foreground',
          )}
        >
          {formatDate(todo.due_date, locale)}
        </Badge>
      ) : null}

      <input
        type="date"
        className="w-[2rem] shrink-0 cursor-pointer bg-transparent text-transparent opacity-40 transition-opacity hover:opacity-100 focus:opacity-100"
        title="Vervaldatum"
        value={todo.due_date ?? ''}
        onChange={(event) => onDueDate(event.target.value || null)}
      />

      <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          title="Omhoog"
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          title="Omlaag"
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title="Verwijderen"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  )
}
