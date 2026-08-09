import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '#/components/auth-provider'
import { LoginScreen } from '#/components/login-screen'
import { AppShell } from '#/components/app-shell'
import { Toaster } from '#/components/ui/sonner'

export const Route = createRootRoute({ component: RootComponent })

function RootComponent() {
  return (
    <AuthProvider>
      <Gate />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  )
}

/** Nothing renders until Supabase confirms a session. */
function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return <LoginScreen />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
