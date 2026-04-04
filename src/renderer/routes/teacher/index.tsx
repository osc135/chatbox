import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Title, Text, Button, Paper, Table, Badge, Stack, Group,
  TextInput, PasswordInput, Select, Modal, ActionIcon, Loader, Anchor,
} from '@mantine/core'
import { IconPlus, IconTrash, IconArrowLeft } from '@tabler/icons-react'
import { getStudents, createStudent, deleteStudent, type Student } from '@/packages/tutorApi'
import { useTutorUser } from '@/stores/tutorAuthStore'

export const Route = createFileRoute('/teacher/')({
  component: TeacherDashboard,
})

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const GRADE_LABEL: Record<string, string> = { K: 'Kindergarten' }
const gradeLabel = (g: string) => GRADE_LABEL[g] ?? `Grade ${g}`

function TeacherDashboard() {
  const navigate = useNavigate()
  const user = useTutorUser()
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

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch(console.error)
      .finally(() => setLoading(false))
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

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      <Group mb={24} justify="space-between">
        <Group gap={8}>
          <ActionIcon variant="subtle" color="gray" onClick={() => navigate({ to: '/' })}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Title order={3} style={{ color: '#fff' }}>My Students</Title>
            <Text size="sm" c="dimmed">{user?.name} · {user?.school ?? 'TutorMeAI'}</Text>
          </div>
        </Group>
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
