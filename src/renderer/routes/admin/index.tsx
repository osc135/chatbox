import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Title, Text, Button, Paper, Table, Badge, Stack, Group,
  ActionIcon, Loader, ThemeIcon, Modal, TextInput, PasswordInput,
} from '@mantine/core'
import { IconArrowLeft, IconSchool, IconUsers, IconBan, IconCheck, IconPlus } from '@tabler/icons-react'
import { getAdminStats, getTeachers, suspendTeacher, createTeacher, type TeacherSummary } from '@/packages/tutorApi'
import { useTutorUser } from '@/stores/tutorAuthStore'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const navigate = useNavigate()
  const user = useTutorUser()
  const [stats, setStats] = useState<{ teacherCount: number; studentCount: number } | null>(null)
  const [teachers, setTeachers] = useState<TeacherSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  // Add teacher modal
  const [modalOpen, setModalOpen] = useState(false)
  const [tName, setTName] = useState('')
  const [tEmail, setTEmail] = useState('')
  const [tPassword, setTPassword] = useState('')
  const [tSchool, setTSchool] = useState('')
  const [tError, setTError] = useState('')
  const [tSaving, setTSaving] = useState(false)

  // Guard: only admins can access this page
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate({ to: '/', replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    Promise.all([getAdminStats(), getTeachers()])
      .then(([s, t]) => { setStats(s); setTeachers(t) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault()
    setTError('')
    setTSaving(true)
    try {
      const teacher = await createTeacher({ name: tName, email: tEmail, password: tPassword, school: tSchool || undefined })
      setTeachers((prev) => [teacher, ...prev])
      setStats((prev) => prev ? { ...prev, teacherCount: prev.teacherCount + 1 } : prev)
      setModalOpen(false)
      setTName(''); setTEmail(''); setTPassword(''); setTSchool('')
    } catch (err) {
      setTError(err instanceof Error ? err.message : 'Failed to create teacher')
    } finally {
      setTSaving(false)
    }
  }

  async function handleToggleSuspend(id: string) {
    setToggling(id)
    try {
      const updated = await suspendTeacher(id)
      setTeachers((prev) => prev.map((t) => t.id === id ? { ...t, suspended: updated.suspended } : t))
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <Group mb={28} justify="space-between">
        <Group gap={8}>
          <ActionIcon variant="subtle" color="gray" onClick={() => navigate({ to: '/' })}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Title order={3} style={{ color: '#fff' }}>Admin Dashboard</Title>
            <Text size="sm" c="dimmed">Platform overview</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>
          Add Teacher
        </Button>
      </Group>

      {/* Stats */}
      <Group mb={28} gap={16}>
        <StatCard
          icon={<IconSchool size={20} />}
          label="Teachers"
          value={stats?.teacherCount ?? '—'}
          color="#c97d2e"
        />
        <StatCard
          icon={<IconUsers size={20} />}
          label="Students"
          value={stats?.studentCount ?? '—'}
          color="#4a90a4"
        />
      </Group>

      {/* Teachers table */}
      <Text size="xs" fw={500} tt="uppercase" c="dimmed" mb={10} style={{ letterSpacing: '0.08em' }}>
        All Teachers
      </Text>
      <Paper radius="md" style={{ background: 'var(--mantine-color-dark-6, #1e1e2e)', overflow: 'hidden' }}>
        {loading ? (
          <Stack align="center" p={40}><Loader /></Stack>
        ) : teachers.length === 0 ? (
          <Stack align="center" p={40}>
            <Text c="dimmed">No teachers yet.</Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>School</Table.Th>
                <Table.Th>Students</Table.Th>
                <Table.Th>Joined</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {teachers.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{t.email}</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{t.school ?? '—'}</Text></Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue">{t._count.students}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{new Date(t.createdAt).toLocaleDateString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={t.suspended ? 'red' : 'green'}>
                      {t.suspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      color={t.suspended ? 'green' : 'red'}
                      loading={toggling === t.id}
                      leftSection={t.suspended ? <IconCheck size={13} /> : <IconBan size={13} />}
                      onClick={() => handleToggleSuspend(t.id)}
                    >
                      {t.suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Add Teacher modal */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Add Teacher" centered>
        <form onSubmit={handleCreateTeacher}>
          <Stack gap="sm">
            <TextInput label="Name" placeholder="Ms. Smith" value={tName} onChange={(e) => setTName(e.target.value)} required autoFocus />
            <TextInput label="Email" type="email" placeholder="teacher@school.edu" value={tEmail} onChange={(e) => setTEmail(e.target.value)} required />
            <PasswordInput label="Password" placeholder="At least 6 characters" value={tPassword} onChange={(e) => setTPassword(e.target.value)} required />
            <TextInput label="School" placeholder="Lincoln Elementary (optional)" value={tSchool} onChange={(e) => setTSchool(e.target.value)} />
            {tError && <Text size="sm" c="red">{tError}</Text>}
            <Button type="submit" loading={tSaving} fullWidth mt={4}>Create Teacher Account</Button>
          </Stack>
        </form>
      </Modal>
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
}) {
  return (
    <Paper
      radius="md"
      p="md"
      style={{ background: 'var(--mantine-color-dark-6, #1e1e2e)', minWidth: 160, flex: '1 1 160px', maxWidth: 220 }}
    >
      <Group gap={12}>
        <ThemeIcon variant="light" size={36} radius="md" style={{ background: `${color}22`, color }}>
          {icon}
        </ThemeIcon>
        <div>
          <Text size="xl" fw={700} style={{ color: '#fff', lineHeight: 1.2 }}>{value}</Text>
          <Text size="xs" c="dimmed">{label}</Text>
        </div>
      </Group>
    </Paper>
  )
}
