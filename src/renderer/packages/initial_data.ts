import { Session } from '../../shared/types'

export const defaultSessionsForEN: Session[] = []
export const defaultSessionsForCN: Session[] = []

// Stub sessions so migration code doesn't crash when referencing preset IDs
const stub = (id: string): Session => ({ id, name: '', type: 'chat', messages: [] } as unknown as Session)

export const imageCreatorSessionForCN = stub('image-creator-cn')
export const imageCreatorSessionForEN = stub('image-creator-en')
export const artifactSessionCN = stub('artifact-cn')
export const artifactSessionEN = stub('artifact-en')
export const mermaidSessionCN = stub('mermaid-cn')
export const mermaidSessionEN = stub('mermaid-en')
