import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { login, signup, getStudents, getTeacherApps } from './tutorApi'

// Prevent tutorAuthStore from touching localStorage (node env has no window)
vi.mock('@/stores/tutorAuthStore', () => ({
  tutorAuthStore: {
    getState: vi.fn(() => ({ token: null })),
  },
}))

import { tutorAuthStore } from '@/stores/tutorAuthStore'

function mockFetchOnce(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const headerMap: Record<string, string> = { 'Content-Type': 'application/json', ...headers }
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headerMap[name] ?? null },
    json: async () => body,
  } as unknown as Response)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('login', () => {
  test('returns token from set-auth-token header and user from body', async () => {
    const user = { id: '1', name: 'Ms Smith', email: 'smith@test.com', role: 'teacher' }
    mockFetchOnce({ user }, 200, { 'set-auth-token': 'token-xyz' })

    const result = await login('smith@test.com', 'pass')
    expect(result.token).toBe('token-xyz')
    expect(result.user).toEqual(user)
  })

  test('throws when server responds with non-ok status', async () => {
    mockFetchOnce({ message: 'Invalid email or password' }, 401)
    await expect(login('x@x.com', 'wrong')).rejects.toThrow('Invalid email or password')
  })

  test('throws when set-auth-token header is absent', async () => {
    mockFetchOnce({ user: { id: '1', name: 'X', email: 'x@x.com', role: 'teacher' } }, 200)
    await expect(login('x@x.com', 'pass')).rejects.toThrow('No token returned')
  })

  test('sends email and password as JSON body', async () => {
    const user = { id: '1', name: 'X', email: 'x@x.com', role: 'teacher' }
    mockFetchOnce({ user }, 200, { 'set-auth-token': 'tok' })

    await login('x@x.com', 'secret')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse((options as RequestInit).body as string) as unknown
    expect(body).toMatchObject({ email: 'x@x.com', password: 'secret' })
  })
})

describe('signup', () => {
  test('returns token and forces role to teacher', async () => {
    const user = { id: '2', name: 'New Teacher', email: 'new@test.com', role: 'student' } // server may return wrong role
    mockFetchOnce({ user }, 200, { 'set-auth-token': 'signup-tok' })

    const result = await signup('New Teacher', 'new@test.com', 'pass')
    expect(result.token).toBe('signup-tok')
    // signup always coerces to teacher regardless of server response
    expect(result.user.role).toBe('teacher')
  })

  test('throws when server returns error', async () => {
    mockFetchOnce({ message: 'Email already in use' }, 400)
    await expect(signup('X', 'x@x.com', 'pass')).rejects.toThrow('Email already in use')
  })
})

describe('authenticated requests', () => {
  test('attaches Authorization header when token is set', async () => {
    vi.mocked(tutorAuthStore.getState).mockReturnValue({ token: 'bearer-tok' } as ReturnType<typeof tutorAuthStore.getState>)
    mockFetchOnce({ students: [] })

    await getStudents()

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    expect((options as RequestInit).headers).toMatchObject({ Authorization: 'Bearer bearer-tok' })
  })

  test('omits Authorization header when not logged in', async () => {
    vi.mocked(tutorAuthStore.getState).mockReturnValue({ token: null } as ReturnType<typeof tutorAuthStore.getState>)
    mockFetchOnce({ students: [] })

    await getStudents()

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    expect((options as RequestInit).headers).not.toMatchObject({ Authorization: expect.anything() })
  })

  test('throws the server error message on non-ok response', async () => {
    vi.mocked(tutorAuthStore.getState).mockReturnValue({ token: 'tok' } as ReturnType<typeof tutorAuthStore.getState>)
    mockFetchOnce({ error: 'Forbidden' }, 403)

    await expect(getTeacherApps()).rejects.toThrow('Forbidden')
  })
})
