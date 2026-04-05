import { tutorAuthStore } from '@/stores/tutorAuthStore'

const API_URL = (process.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tutorAuthStore.getState().token

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error ?? 'Request failed')
  }

  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: 'admin' | 'teacher' | 'student'
    grade?: string | null
    school?: string | null
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Invalid email or password')
  }

  // Better Auth returns the token in the set-auth-token header
  const token = res.headers.get('set-auth-token')
  const data = await res.json() as { user: AuthResponse['user'] }

  if (!token) throw new Error('No token returned from server')

  return { token, user: data.user }
}

export async function signup(name: string, email: string, password: string, school?: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, school }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Signup failed')
  }

  const token = res.headers.get('set-auth-token')
  const data = await res.json() as { user: AuthResponse['user'] }

  if (!token) throw new Error('No token returned from server')

  // New signups are teachers — set role explicitly since signup doesn't set it
  return { token, user: { ...data.user, role: 'teacher' } }
}

// ── Teacher ───────────────────────────────────────────────────────────────────

export interface Student {
  id: string
  name: string
  email: string
  grade: string
  createdAt: string
}

export const getStudents = () =>
  request<{ students: Student[] }>('/api/teacher/students').then((r) => r.students)

export const createStudent = (data: { name: string; email: string; grade: string; password: string }) =>
  request<{ student: Student }>('/api/teacher/students', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => r.student)

export const updateStudent = (id: string, data: { name?: string; grade?: string }) =>
  request<{ student: Student }>(`/api/teacher/students/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then((r) => r.student)

export const deleteStudent = (id: string) =>
  request<{ ok: boolean }>(`/api/teacher/students/${id}`, { method: 'DELETE' })

// ── Teacher apps ──────────────────────────────────────────────────────────────

export const getTeacherApps = () =>
  request<{ enabledApps: string[] }>('/api/teacher/apps').then((r) => r.enabledApps)

export const updateTeacherApps = (enabledApps: string[]) =>
  request<{ enabledApps: string[] }>('/api/teacher/apps', {
    method: 'PATCH',
    body: JSON.stringify({ enabledApps }),
  }).then((r) => r.enabledApps)

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface TeacherSummary {
  id: string
  name: string
  email: string
  school: string | null
  suspended: boolean
  createdAt: string
  _count: { students: number }
}

export const createTeacher = (data: { name: string; email: string; password: string; school?: string }) =>
  request<{ teacher: TeacherSummary }>('/api/admin/teachers', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => r.teacher)

export const getAdminStats = () =>
  request<{ teacherCount: number; studentCount: number }>('/api/admin/stats')

export const getTeachers = () =>
  request<{ teachers: TeacherSummary[] }>('/api/admin/teachers').then((r) => r.teachers)

export const suspendTeacher = (id: string) =>
  request<{ teacher: { id: string; suspended: boolean } }>(`/api/admin/teachers/${id}/suspend`, {
    method: 'PATCH',
  }).then((r) => r.teacher)
