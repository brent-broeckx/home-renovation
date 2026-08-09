import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  CheckSquare,
  HardHat,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Paintbrush,
  Settings,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { useAuth } from '#/components/auth-provider'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/works', label: 'Werken', icon: HardHat },
  { to: '/finishes', label: 'Afwerkingen', icon: Paintbrush },
  { to: '/todos', label: "To-do's", icon: ListTodo },
  { to: '/settings', label: 'Instellingen', icon: Settings },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, session } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold no-underline"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare className="size-4" />
            </span>
            <span className="hidden sm:inline">Renovatie Tracker</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
                  pathname === item.to
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground lg:inline">
              {session?.user.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void signOut()}
              title="Afmelden"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-3 pb-24 pt-4 sm:px-6 md:pb-10">
        {children}
      </main>

      {/* Mobile bottom navigation - thumb reachable while standing on site. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium no-underline transition-colors',
                pathname === item.to ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
