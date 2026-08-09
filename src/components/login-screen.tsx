import { useState } from 'react'
import { HardHat, Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { supabase, isSupabaseConfigured } from '#/lib/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) setError(signInError.message)
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="size-6" />
          </div>
          <CardTitle className="text-xl">Renovatie Tracker</CardTitle>
          <CardDescription>
            Meld je aan om je dossier te bekijken
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured ? (
            <Alert variant="destructive">
              <AlertDescription>
                Supabase is niet geconfigureerd. Stel{' '}
                <code>VITE_SUPABASE_URL</code> en{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> in.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LockKeyhole className="size-4" />
                )}
                Aanmelden
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Alle gegevens zijn afgeschermd met Row Level Security.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
