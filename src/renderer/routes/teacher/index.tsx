import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Title, Text, Button, Paper, Table, Badge, Stack, Group,
  TextInput, PasswordInput, Select, Modal, ActionIcon, Loader, Anchor,
  Tabs, Switch, SimpleGrid,
} from '@mantine/core'
import { IconPlus, IconTrash, IconArrowLeft, IconUsers, IconApps } from '@tabler/icons-react'
import {
  getStudents, createStudent, deleteStudent, type Student,
  getTeacherApps, updateTeacherApps,
} from '@/packages/tutorApi'
import { useTutorUser } from '@/stores/tutorAuthStore'

export const Route = createFileRoute('/teacher/')({
  component: TeacherDashboard,
})

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const GRADE_LABEL: Record<string, string> = { K: 'Kindergarten' }
const gradeLabel = (g: string) => GRADE_LABEL[g] ?? `Grade ${g}`

const ALL_APPS = [
  { id: 'chess',    label: 'Chess',      description: 'Strategic chess against an AI opponent' },
  { id: 'weather',  label: 'Weather',    description: 'Current conditions and 5-day forecast' },
  { id: 'counting', label: 'Counting',   description: 'K-2 math practice with 3 difficulty levels' },
  { id: 'vocab',    label: 'Vocabulary', description: 'Flashcard deck with quiz mode' },
]

function TeacherDashboard() {
  const navigate = useNavigate()
  const user = useTutorUser()

  // Students and non-authenticated users have no business here
  useEffect(() => {
    if (user && user.role !== 'teacher') {
      void navigate({ to: '/', replace: true })
    }
  }, [user, navigate])

  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New student form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [grade, setGrade] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Apps tab
  const [enabledApps, setEnabledApps] = useState<string[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [appsSaving, setAppsSaving] = useState(false)
  const [appsSaved, setAppsSaved] = useState(false)

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch(console.error)
      .finally(() => setLoading(false))

    getTeacherApps()
      .then((apps) => setEnabledApps(apps.length > 0 ? apps : ALL_APPS.map((a) => a.id)))
      .catch(console.error)
      .finally(() => setAppsLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!grade) { setFormError('Please select a grade'); return }
    setFormError('')
    setSaving(true)
    try {
      const student = await createStudent({ name, email, grade, password })
      setStudents((prev) => [...prev, student])
      setModalOpen(false)
      setName(''); setEmail(''); setGrade(null); setPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await deleteStudent(id)
      setStudents((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(null)
    }
  }

  function toggleApp(appId: string) {
    setEnabledApps((prev) =>
      prev.includes(appId) ? prev.filter((a) => a !== appId) : [...prev, appId]
    )
    setAppsSaved(false)
  }

  async function handleSaveApps() {
    setAppsSaving(true)
    try {
      const saved = await updateTeacherApps(enabledApps)
      setEnabledApps(saved.length > 0 ? saved : ALL_APPS.map((a) => a.id))
      setAppsSaved(true)
      setTimeout(() => setAppsSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setAppsSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      <Group mb={24} justify="space-between">
        <Group gap={8}>
          <ActionIcon variant="subtle" color="gray" onClick={() => navigate({ to: '/' })}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Title order={3} style={{ color: '#fff' }}>Teacher Dashboard</Title>
            <Text size="sm" c="dimmed">{user?.name} · {user?.school ?? 'TutorMeAI'}</Text>
          </div>
        </Group>
      </Group>

      <Tabs defaultValue="students">
        <Tabs.List mb={20}>
          <Tabs.Tab value="students" leftSection={<IconUsers size={15} />}>
            Students
          </Tabs.Tab>
          <Tabs.Tab value="apps" leftSection={<IconApps size={15} />}>
            Apps
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Students tab ── */}
        <Tabs.Panel value="students">
          <Group mb={16} justify="flex-end">
            <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>
              Add Student
            </Button>
          </Group>

          <Paper radius="md" style={{ background: 'var(--mantine-color-dark-6, #1e1e2e)', overflow: 'hidden' }}>
            {loading ? (
              <Stack align="center" p={40}><Loader /></Stack>
            ) : students.length === 0 ? (
              <Stack align="center" p={40} gap={8}>
                <Text c="dimmed">No students yet.</Text>
                <Anchor size="sm" onClick={() => setModalOpen(true)}>Add your first student →</Anchor>
              </Stack>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Grade</Table.Th>
                    <Table.Th>Added</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {students.map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td>{s.name}</Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">{s.email}</Text></Table.Td>
                      <Table.Td><Badge variant="light">{gradeLabel(s.grade)}</Badge></Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">{new Date(s.createdAt).toLocaleDateString()}</Text></Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle" color="red" size="sm"
                          loading={deleting === s.id}
                          onClick={() => handleDelete(s.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ── Apps tab ── */}
        <Tabs.Panel value="apps">
          <Text size="sm" c="dimmed" mb={16}>
            Choose which apps are available to your students in chat.
            Disabled apps won't appear as options for the AI to launch.
          </Text>

          {appsLoading ? (
            <Stack align="center" p={40}><Loader /></Stack>
          ) : (
            <>
              <SimpleGrid cols={2} spacing="sm" mb={20}>
                {ALL_APPS.map((app) => (
                  <Paper
                    key={app.id}
                    radius="md"
                    p="md"
                    style={{
                      background: 'var(--mantine-color-dark-6, #1e1e2e)',
                      border: `1px solid ${enabledApps.includes(app.id) ? 'rgba(201,125,46,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <Group justify="space-between" align="flex-start">
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="sm" style={{ color: '#fff' }}>{app.label}</Text>
                        <Text size="xs" c="dimmed" mt={2}>{app.description}</Text>
                      </div>
                      <Switch
                        checked={enabledApps.includes(app.id)}
                        onChange={() => toggleApp(app.id)}
                        size="sm"
                      />
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>

              <Group>
                <Button
                  onClick={handleSaveApps}
                  loading={appsSaving}
                  color={appsSaved ? 'green' : undefined}
                >
                  {appsSaved ? 'Saved!' : 'Save Changes'}
                </Button>
              </Group>
            </>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Add Student" centered>
        <form onSubmit={handleCreate}>
          <Stack gap="sm">
            <TextInput label="Name" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            <TextInput label="Email" type="email" placeholder="student@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Select label="Grade" placeholder="Select grade" data={GRADES.map((g) => ({ value: g, label: gradeLabel(g) }))} value={grade} onChange={setGrade} required />
            <PasswordInput label="Password" description="Student will receive this by email" placeholder="At least 4 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {formError && <Text size="sm" c="red">{formError}</Text>}
            <Button type="submit" loading={saving} fullWidth mt={4}>Add Student</Button>
          </Stack>
        </form>
      </Modal>
    </div>
  )
}
