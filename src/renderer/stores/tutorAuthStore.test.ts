// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { tutorAuthStore } from './tutorAuthStore'
import type { TutorUser } from './tutorAuthStore'

const teacher: TutorUser = { id: 't1', name: 'Ms Smith', email: 'smith@school.edu', role: 'teacher', school: 'Westside' }
const student: TutorUser = { id: 's1', name: 'Alice', email: 'alice@school.edu', role: 'student', grade: '5' }

beforeEach(() => {
  tutorAuthStore.getState().clearAuth()
  localStorage.clear()
})

describe('tutorAuthStore', () => {
  test('starts with null token and user', () => {
    const { token, user } = tutorAuthStore.getState()
    expect(token).toBeNull()
    expect(user).toBeNull()
  })

  test('setAuth stores token and user', () => {
    tutorAuthStore.getState().setAuth('tok-abc', teacher)
    const { token, user } = tutorAuthStore.getState()
    expect(token).toBe('tok-abc')
    expect(user).toEqual(teacher)
  })

  test('clearAuth resets token and user to null', () => {
    tutorAuthStore.getState().setAuth('tok-abc', teacher)
    tutorAuthStore.getState().clearAuth()
    const { token, user } = tutorAuthStore.getState()
    expect(token).toBeNull()
    expect(user).toBeNull()
  })

  test('setAuth accepts student users', () => {
    tutorAuthStore.getState().setAuth('tok-student', student)
    expect(tutorAuthStore.getState().user?.role).toBe('student')
    expect(tutorAuthStore.getState().user?.grade).toBe('5')
  })

  test('overwriting auth replaces previous token and user', () => {
    tutorAuthStore.getState().setAuth('old-token', teacher)
    tutorAuthStore.getState().setAuth('new-token', student)
    const { token, user } = tutorAuthStore.getState()
    expect(token).toBe('new-token')
    expect(user?.role).toBe('student')
  })
})
