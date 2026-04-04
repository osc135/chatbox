import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { TextInput, PasswordInput, Button, Paper, Title, Text, Tabs, Stack, Anchor } from '@mantine/core'
import { login, signup } from '@/packages/tutorApi'
import { tutorAuthStore } from '@/stores/tutorAuthStore'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<string>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup form
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupSchool, setSignupSchool] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await login(loginEmail, loginPassword)
      tutorAuthStore.getState().setAuth(token, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as 'teacher' | 'student',
        grade: user.grade,
        school: user.school,
      })
      navigate({ to: '/', replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await signup(signupName, signupEmail, signupPassword, signupSchool || undefined)
      tutorAuthStore.getState().setAuth(token, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'teacher',
        school: signupSchool || null,
      })
      navigate({ to: '/', replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--mantine-color-dark-8, #1a1a2e)',
    }}>
      <Paper
        shadow="xl"
        p={36}
        radius="lg"
        style={{ width: '100%', maxWidth: 420, background: 'var(--mantine-color-dark-6, #1e1e2e)' }}
      >
        <Title order={2} mb={4} style={{ color: '#fff' }}>TutorMeAI</Title>
        <Text size="sm" c="dimmed" mb={24}>Sign in to your account</Text>

        <Tabs value={tab} onChange={(v) => { setTab(v ?? 'login'); setError('') }}>
          <Tabs.List mb={20}>
            <Tabs.Tab value="login">Sign In</Tabs.Tab>
            <Tabs.Tab value="signup">Teacher Sign Up</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="login">
            <form onSubmit={handleLogin}>
              <Stack gap="sm">
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="you@school.edu"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
                <PasswordInput
                  label="Password"
                  placeholder="Your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                {error && <Text size="sm" c="red">{error}</Text>}
                <Button type="submit" loading={loading} fullWidth mt={4}>
                  Sign In
                </Button>
              </Stack>
            </form>
          </Tabs.Panel>

          <Tabs.Panel value="signup">
            <form onSubmit={handleSignup}>
              <Stack gap="sm">
                <TextInput
                  label="Your Name"
                  placeholder="Ms. Smith"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                  autoFocus
                />
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="teacher@school.edu"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
                <PasswordInput
                  label="Password"
                  placeholder="At least 8 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
                <TextInput
                  label="School (optional)"
                  placeholder="Lincoln Elementary"
                  value={signupSchool}
                  onChange={(e) => setSignupSchool(e.target.value)}
                />
                {error && <Text size="sm" c="red">{error}</Text>}
                <Button type="submit" loading={loading} fullWidth mt={4}>
                  Create Teacher Account
                </Button>
              </Stack>
            </form>
          </Tabs.Panel>
        </Tabs>

        <Text size="xs" c="dimmed" ta="center" mt={20}>
          Students:{' '}
          <Anchor size="xs" href="mailto:">ask your teacher for your login</Anchor>
        </Text>
      </Paper>
    </div>
  )
}
