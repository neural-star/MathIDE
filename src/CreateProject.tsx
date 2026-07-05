import { useState } from 'react'

export default function CreateProject({ onCreate }: { onCreate: (name: string) => Promise<any> }) {
  const [name, setName] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="project-name" />
      <button className="secondary-button" onClick={() => { if (name) { onCreate(name); setName('') } }}>Create</button>
    </div>
  )
}
