import { useState } from 'react'

export default function ProjectManager({
  userName,
  projects,
  onCreate,
  onLoad,
  onDelete,
  onRename,
}: {
  userName: string
  projects: string[]
  onCreate: (name: string) => Promise<any>
  onLoad: (name: string) => Promise<any>
  onDelete: (name: string) => Promise<any>
  onRename: (oldName: string, newName: string) => Promise<any>
}) {
  const [newName, setNewName] = useState('')

  return (
    <div style={{ padding: 28 }}>
      <h2>{userName} のプロジェクト</h2>
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <input placeholder="新しいプロジェクト名" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ padding: 10, borderRadius: 8, width: '60%', marginRight: 8 }} />
        <button className="primary-button" onClick={() => { if (newName) { onCreate(newName); setNewName('') } }}>作成</button>
      </div>

      <div>
        {projects.length === 0 ? (
          <p>プロジェクトがありません。新しく作成してください。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
            {projects.map((p) => (
              <li key={p} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="secondary-button" style={{ flex: '1 1 auto' }} onClick={() => onLoad(p)}>{p}</button>
                <button className="ghost-button" onClick={() => { const nn = prompt('新しい名前', p); if (nn) onRename(p, nn) }}>名前変更</button>
                <button className="ghost-button" onClick={() => { if (confirm('削除しますか？')) onDelete(p) }}>削除</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
