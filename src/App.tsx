import { useEffect, useRef, useState } from 'react'
import './App.css'
import CreateProject from './CreateProject'
import Home from './Home'
import ProjectManager from './ProjectManager'

type Cell = {
  id: number
  code: string
  output: string
  error: string
  isRunning: boolean
  backend: 'local' | 'wolframalpha'
  images?: Array<{ src: string; title: string; alt: string }>
}

type Settings = {
  defaultBackend: 'local' | 'wolframalpha'
  runShortcut: string
  addCellShortcut: string
}

const createCell = (code = '2 + 2', backend: 'local' | 'wolframalpha' = 'local'): Cell => ({
  id: Date.now() + Math.random(),
  code,
  output: 'Run a cell to see the result here.',
  error: '',
  isRunning: false,
  backend,
})

const shortcutMatches = (event: KeyboardEvent, shortcut: string) => {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

  const wantsCtrl = parts.includes('ctrl') || parts.includes('control')
  const wantsMeta = parts.includes('cmd') || parts.includes('meta')
  const wantsAlt = parts.includes('alt')
  const wantsShift = parts.includes('shift')
  const keyPart = parts.find(
    (part) => !['ctrl', 'control', 'cmd', 'meta', 'alt', 'shift'].includes(part),
  )

  const actualKey = event.key.toLowerCase()
  const ctrlOk = wantsCtrl ? event.ctrlKey || event.metaKey : !event.ctrlKey
  const metaOk = wantsMeta ? event.metaKey : !event.metaKey
  const altOk = wantsAlt ? event.altKey : !event.altKey
  const shiftOk = wantsShift ? event.shiftKey : !event.shiftKey

  const keyOk = keyPart
    ? keyPart === 'enter'
      ? event.key === 'Enter'
      : actualKey === keyPart
    : true

  return ctrlOk && metaOk && altOk && shiftOk && keyOk
}

const parseWolframAlphaResult = (result: any) => {
  const queryResult = result?.queryresult
  const pods = Array.isArray(queryResult?.pods) ? queryResult.pods : []
  const lines: string[] = []
  const images: Array<{ src: string; title: string; alt: string }> = []

  const extractSubpodText = (subpod: any) => {
    if (typeof subpod?.plaintext === 'string' && subpod.plaintext.trim()) {
      return subpod.plaintext.trim()
    }
    if (typeof subpod?.img?.alt === 'string' && subpod.img.alt.trim()) {
      return subpod.img.alt.trim()
    }
    return ''
  }

  const collectImages = (pod: any) => {
    for (const subpod of pod.subpods ?? []) {
      const src = subpod?.img?.src
      if (!src) continue
      if (images.some((img) => img.src === src)) continue
      images.push({
        src,
        title: subpod?.img?.title || pod.title || 'WolframAlpha',
        alt: subpod?.img?.alt || pod.title || 'WolframAlpha',
      })
      if (images.length >= 6) return
    }
  }

  const relevantTitles = new Set([
    'result',
    'input',
    'exact result',
    'decimal approximation',
    'plot',
    'plots',
    'image',
    'graphs',
    'graph',
    'solution',
    'root',
    'expression',
    'derivative',
    'integral',
    'simplification',
    'alternate form',
  ])

  const normalTitle = (title: string) => title.trim().toLowerCase()

  const primaryPod = pods.find((p: any) => p.primary) || pods.find((p: any) => normalTitle(p.title) === 'result') || pods[0]

  const addPodLine = (pod: any) => {
    const podText = (pod.subpods ?? [])
      .map(extractSubpodText)
      .filter(Boolean)
      .join(' | ')

    if (!podText) return false
    lines.push(`${pod.title}: ${podText}`)
    return true
  }

  if (primaryPod) {
    addPodLine(primaryPod)
    collectImages(primaryPod)
  }

  let added = 0
  for (const pod of pods) {
    if (pod === primaryPod) continue
    if (added >= 3) break
    const title = normalTitle(pod.title || '')
    if (!relevantTitles.has(title)) continue
    if (addPodLine(pod)) {
      added += 1
      collectImages(pod)
    }
  }

  if (lines.length === 0) {
    return { text: 'WolframAlpha returned no readable text output.', images }
  }

  return { text: lines.join('\n\n'), images }
}

function App() {
  const [cells, setCells] = useState<Cell[]>([createCell('2 + 2')])
  const [activeCellId, setActiveCellId] = useState<number | null>(null)
  const [settings, setSettings] = useState<Settings>({
    defaultBackend: 'local',
    runShortcut: 'Ctrl+Enter',
    addCellShortcut: 'Ctrl+Alt+N',
  })
  const [showSettings, setShowSettings] = useState(false)
  const [capturingRun, setCapturingRun] = useState(false)
  const [capturingAdd, setCapturingAdd] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [moreOpenId, setMoreOpenId] = useState<number | null>(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [userName, setUserName] = useState<string | null>(() => {
    try {
      return localStorage.getItem('userName') || null
    } catch {
      return null
    }
  })
  const [loginOpen, setLoginOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ src: string; title: string; alt: string } | null>(null)
  const [projects, setProjects] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('projects')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [currentProject, setCurrentProject] = useState<string | null>(() => {
    try {
      return localStorage.getItem('currentProject') || null
    } catch {
      return null
    }
  })
  const [swipeOffsets, setSwipeOffsets] = useState<Record<number, number>>({})
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})
  const longPressTimer = useRef<number | null>(null)

  useEffect(() => {
    if (cells.length > 0 && activeCellId === null) {
      setActiveCellId(cells[0].id)
    }
  }, [activeCellId, cells])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 600)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const vv = (window as any).visualViewport
    if (!vv) return
    const onVv = () => {
      // heuristics: keyboard visible if visualViewport height significantly less than window.innerHeight
      setKeyboardVisible(vv.height < window.innerHeight - 120)
    }
    vv.addEventListener('resize', onVv)
    vv.addEventListener('scroll', onVv)
    return () => {
      vv.removeEventListener('resize', onVv)
      vv.removeEventListener('scroll', onVv)
    }
  }, [])

  const updateCell = (cellId: number, updates: Partial<Cell>) => {
    setCells((currentCells) =>
      currentCells.map((cell) => (cell.id === cellId ? { ...cell, ...updates } : cell)),
    )
  }

  const addCell = (position: 'top' | 'bottom') => {
    const newCell = createCell('', settings.defaultBackend)
    setCells((currentCells) =>
      position === 'top' ? [newCell, ...currentCells] : [...currentCells, newCell],
    )
    setActiveCellId(newCell.id)
  }
  
  const addCellBelowAt = (index: number) => {
    const newCell = createCell('', settings.defaultBackend)
    setCells((currentCells) => {
      const next = [...currentCells]
      next.splice(index + 1, 0, newCell)
      return next
    })
    setActiveCellId(newCell.id)
  }
  
  const duplicateCell = (index: number) => {
    setCells((currentCells) => {
      const next = [...currentCells]
      const source = next[index]
      const copy = createCell(source.code, source.backend)
      next.splice(index + 1, 0, copy)
      return next
    })
  }
  
  const deleteCell = (index: number) => {
    setCells((currentCells) => {
      const next = [...currentCells]
      next.splice(index, 1)
      return next.length ? next : [createCell('', settings.defaultBackend)]
    })
  }
  
  const moveCell = (from: number, to: number) => {
    setCells((currentCells) => {
      const next = [...currentCells]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const runCell = async (cellId: number) => {
    const targetCell = cells.find((cell) => cell.id === cellId)
    if (!targetCell) return

    updateCell(cellId, {
      isRunning: true,
      error: '',
      output: 'Executing...',
    })

    let url = ''
    let requestOptions: RequestInit = { method: 'POST' }

    if (!userName || !currentProject) {
      updateCell(cellId, { isRunning: false, error: 'Not logged in or project not selected' })
      return
    }

    if (targetCell.backend === 'local') {
      url = `/user/${encodeURIComponent(userName)}/${encodeURIComponent(currentProject)}/cas/execute/`
      requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: targetCell.code,
          user_name: userName,
          project_name: currentProject,
          description: 'Executed from the notebook-style web UI',
        }),
      }
    } else {
      url = `/user/${encodeURIComponent(userName)}/${encodeURIComponent(currentProject)}/wolframalpha/`
      requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetCell.code }),
      }
    }

    try {
      const response = await fetch(url, requestOptions)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail?.[0]?.msg ?? 'Request failed')
      }

      const result = targetCell.backend === 'local' ? data.data : data.result
      if (targetCell.backend === 'wolframalpha') {
        const formatted = parseWolframAlphaResult(result)
        updateCell(cellId, {
          output: formatted.text,
          images: formatted.images,
        })
      } else {
        updateCell(cellId, {
          output: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          images: undefined,
        })
      }
    } catch (err) {
      updateCell(cellId, {
        error: err instanceof Error ? err.message : 'Unknown error',
        output: '',
      })
    } finally {
      updateCell(cellId, {
        isRunning: false,
      })
    }
  }

  const insertSymbolToActive = (symbol: string) => {
    if (!activeCellId) return
    const ta = textareaRefs.current[activeCellId]
    if (!ta) return
    const start = ta.selectionStart ?? ta.value.length
    const end = ta.selectionEnd ?? start
    const before = ta.value.slice(0, start)
    const after = ta.value.slice(end)
    const next = before + symbol + after
    updateCell(activeCellId, { code: next })
    // set caret after inserted symbol
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + symbol.length
      ta.selectionStart = pos
      ta.selectionEnd = pos
    })
  }

  const handleTouchStart = (e: React.TouchEvent, _id: number) => {
    const t = e.touches[0] as Touch
    ;(e.target as HTMLElement).dataset.startX = String(t.clientX)
  }

  const handleTouchMove = (e: React.TouchEvent, id: number) => {
    const t = e.touches[0] as Touch
    const startX = Number((e.currentTarget as HTMLElement).dataset.startX || 0)
    const dx = t.clientX - startX
    // only horizontal left swipe
    if (dx < 0) {
      setSwipeOffsets((s) => ({ ...s, [id]: dx }))
    }
  }

  const handleTouchEnd = (_e: React.TouchEvent, index: number, id: number) => {
    const offset = swipeOffsets[id] ?? 0
    if (offset < -80) {
      // confirm deletion quickly
      if (confirm('Delete this cell?')) {
        deleteCell(index)
      }
    }
    setSwipeOffsets((s) => ({ ...s, [id]: 0 }))
  }

  // Drag (long-press for touch -> emulate drag)
  const onPointerDownForDrag = (e: React.PointerEvent, id: number) => {
    // start long press
    longPressTimer.current = window.setTimeout(() => {
      setDraggingId(id);
      (e.target as Element).classList.add('dragging')
    }, 450)
  }

  const onPointerUpForDrag = (_e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (draggingId !== null) {
      // drop: if we have a dragOverIndex, move
      if (dragOverIndex !== null) {
        const fromIndex = cells.findIndex((c) => c.id === draggingId)
        if (fromIndex >= 0 && dragOverIndex >= 0) moveCell(fromIndex, dragOverIndex)
      }
      setDraggingId(null)
      setDragOverIndex(null)
      document.querySelectorAll('.cell-card.dragging').forEach((el) => el.classList.remove('dragging'))
    }
  }

  const onPointerMoveForDrag = (e: any) => {
    if (draggingId === null) return
    const clientY = e.clientY
    // find cell under point
    const el = document.elementFromPoint(e.clientX ?? 0, clientY)
    if (!el) return
    const section = el.closest && (el.closest('.cell-card') as HTMLElement | null)
    if (!section) return
    const idx = Number(section.dataset.index)
    if (!Number.isNaN(idx)) setDragOverIndex(idx)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // capture shortcuts when user is defining them in settings modal
      if (capturingRun) {
        event.preventDefault()
        const parts: string[] = []
        if (event.ctrlKey) parts.push('Ctrl')
        if (event.metaKey) parts.push('Cmd')
        if (event.altKey) parts.push('Alt')
        if (event.shiftKey) parts.push('Shift')
        parts.push(event.key === ' ' ? 'Space' : event.key)
        setSettings((s) => ({ ...s, runShortcut: parts.join('+') }))
        setCapturingRun(false)
        return
      }

      if (capturingAdd) {
        event.preventDefault()
        const parts: string[] = []
        if (event.ctrlKey) parts.push('Ctrl')
        if (event.metaKey) parts.push('Cmd')
        if (event.altKey) parts.push('Alt')
        if (event.shiftKey) parts.push('Shift')
        parts.push(event.key === ' ' ? 'Space' : event.key)
        setSettings((s) => ({ ...s, addCellShortcut: parts.join('+') }))
        setCapturingAdd(false)
        return
      }

      if (shortcutMatches(event, settings.runShortcut)) {
        event.preventDefault()
        if (activeCellId) {
          void runCell(activeCellId)
        }
        return
      }

      if (shortcutMatches(event, settings.addCellShortcut)) {
        event.preventDefault()
        addCell('bottom')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeCellId, cells, settings])

  const activeCellCount = cells.length

  // Persist projects list to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('projects', JSON.stringify(projects))
    } catch {}
  }, [projects])

  const openLogin = () => setLoginOpen(true)

  const doLogin = (name: string) => {
    setUserName(name)
    setLoginOpen(false)
    // open dashboard automatically after login
    setDashboardOpen(true)
  }

  const doCreateAccount = (name: string) => {
    setUserName(name)
    setDashboardOpen(true)
    // save created account locally
    setProjects([])
    setLoginOpen(false)
  }

  useEffect(() => {
    try {
      if (userName) {
        localStorage.setItem('userName', userName)
      } else {
        localStorage.removeItem('userName')
      }
    } catch {
      // ignore
    }
  }, [userName])

  useEffect(() => {
    try {
      if (currentProject) {
        localStorage.setItem('currentProject', currentProject)
      } else {
        localStorage.removeItem('currentProject')
      }
    } catch {
      // ignore
    }
  }, [currentProject])

  const createProjectRemote = async (name: string) => {
    if (!userName) return
    const url = `/user/${encodeURIComponent(userName)}/${encodeURIComponent(name)}/project/create/`
    const res = await fetch(url, { method: 'POST' })
    const j = await res.json()
    // add to local known list
    setProjects((p) => (p.includes(name) ? p : [...p, name]))
    return j
  }

  const deleteProjectRemote = async (name: string) => {
    if (!userName) return
    const url = `/user/${encodeURIComponent(userName)}/${encodeURIComponent(name)}/project/delete/`
    const res = await fetch(url, { method: 'DELETE' })
    const j = await res.json()
    setProjects((p) => p.filter((x) => x !== name))
    if (currentProject === name) setCurrentProject(null)
    return j
  }

  const renameProjectRemote = async (oldName: string, newName: string) => {
    if (!userName) return
    const url = `/user/${encodeURIComponent(userName)}/${encodeURIComponent(oldName)}/project/rename/?new_name=${encodeURIComponent(newName)}`
    const res = await fetch(url, { method: 'POST' })
    const j = await res.json()
    setProjects((p) => p.map((x) => (x === oldName ? newName : x)))
    if (currentProject === oldName) setCurrentProject(newName)
    return j
  }

  const saveProjectRemote = async (name: string) => {
    if (!userName) return
    const url = `/user/${encodeURIComponent(userName)}/${encodeURIComponent(name)}/project/save/`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells }),
    })
    return res.json()
  }

  const loadProjectRemote = async (name: string) => {
    if (!userName) return { message: 'not logged in' }
    const url = `/user/${encodeURIComponent(userName)}/${encodeURIComponent(name)}/project/data/`
    const res = await fetch(url)
    const j = await res.json()
    if (j.data) {
      // expect project to contain { cells: [...] } or raw cells array
      const payload = j.data.cells ?? j.data
      if (Array.isArray(payload)) {
        setCells(payload as Cell[])
      }
    }
    setCurrentProject(name)
    setDashboardOpen(false)
    return j
  }

  if (!userName) {
    return (
      <div className="notebook-shell">
        <Home onLogin={doLogin} onCreate={doCreateAccount} />
      </div>
    )
  }

  // if logged in but no project selected, show project manager full-screen
  if (userName && !currentProject) {
    return (
      <div className="notebook-shell">
        <ProjectManager
          userName={userName}
          projects={projects}
          onCreate={async (name) => { await createProjectRemote(name) }}
          onLoad={async (name) => { await loadProjectRemote(name) }}
          onDelete={async (name) => { await deleteProjectRemote(name) }}
          onRename={async (oldName, newName) => { await renameProjectRemote(oldName, newName) }}
        />
      </div>
    )
  }

  return (
    <div className="notebook-shell">
      <aside className={`notebook-sidebar ${isMobile && !sidebarOpen ? 'collapsed' : ''}`}>
        {isMobile && sidebarOpen ? (
          <div className="sidebar-top">
            <button className="secondary-button" onClick={() => setSidebarOpen(false)}>Close</button>
          </div>
        ) : null}
        <p className="sidebar-label">MathIDE</p>
        <h1>Notebook</h1>
        <p className="sidebar-copy">
          A JupyterLab-style workspace that sends requests to the FastAPI backend
          launched from app.py.
        </p>
        <div className="settings-summary">
          <p>
            Default backend: <strong>{settings.defaultBackend === 'local' ? 'Local CAS' : 'WolframAlpha'}</strong>
          </p>
          <p>
            Run: <strong>{settings.runShortcut}</strong>
          </p>
          <p>
            Add cell: <strong>{settings.addCellShortcut}</strong>
          </p>
          <button className="secondary-button" onClick={() => setShowSettings(true)}>Open Settings</button>
        </div>
      </aside>

      <main className="notebook-main">
        <header className="notebook-toolbar">
          <div>
            <p className="toolbar-kicker">Interactive workspace</p>
            <h2>MathIDE Notebook</h2>
          </div>
          <div className="toolbar-actions-right">
            <div className="toolbar-actions-row">
              <button className="secondary-button hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
              <button type="button" className="secondary-button" onClick={() => addCell('top')}>
                ＋ Add top
              </button>
              <button type="button" className="secondary-button" onClick={() => addCell('bottom')}>
                ＋ Add bottom
              </button>
              <button type="button" className="secondary-button" onClick={() => setShowSettings(true)}>⚙︎</button>
              <button type="button" className="secondary-button" onClick={() => setCurrentProject(null)}>
                プロジェクト管理
              </button>
              {userName ? (
                <button className="secondary-button" onClick={() => setDashboardOpen(true)}>{userName}</button>
              ) : (
                <button className="secondary-button" onClick={openLogin}>Login</button>
              )}
            </div>
          </div>
        </header>

        {cells.map((cell, index) => {
          const isActive = cell.id === activeCellId

          return (
            <section
              key={cell.id}
              data-index={index}
              className={`cell-card${isActive ? ' active' : ''}${draggingId === cell.id ? ' dragging' : ''}`}
              style={{ transform: `translateX(${swipeOffsets[cell.id] ?? 0}px)` }}
              draggable={!isMobile}
              onDragStart={(ev) => {
                ev.dataTransfer?.setData('text/plain', String(index))
                ev.dataTransfer?.setDragImage?.(ev.currentTarget as Element, 20, 20)
              }}
              onDragOver={(ev) => {
                ev.preventDefault()
                const overIdx = Number((ev.currentTarget as HTMLElement).dataset.index)
                if (!Number.isNaN(overIdx)) setDragOverIndex(overIdx)
              }}
              onDrop={(ev) => {
                ev.preventDefault()
                const from = Number(ev.dataTransfer?.getData('text/plain'))
                const to = Number((ev.currentTarget as HTMLElement).dataset.index)
                if (!Number.isNaN(from) && !Number.isNaN(to)) moveCell(from, to)
              }}
              onPointerDown={(e) => onPointerDownForDrag(e, cell.id)}
              onPointerUp={onPointerUpForDrag}
              onPointerMove={onPointerMoveForDrag}
              onTouchStart={(e) => handleTouchStart(e, cell.id)}
              onTouchMove={(e) => handleTouchMove(e, cell.id)}
              onTouchEnd={(e) => handleTouchEnd(e, index, cell.id)}
            >
              <div className="cell-header">
                <div className="cell-heading-left">
                  <span className="cell-index">In [{index + 1}]:</span>
                  <button
                    type="button"
                    className={`backend-toggle-cell${cell.backend === 'local' ? ' on' : ' off'}`}
                    onClick={() =>
                      updateCell(cell.id, {
                        backend: cell.backend === 'local' ? 'wolframalpha' : 'local',
                      })
                    }
                  >
                    {cell.backend === 'local' ? 'Local' : 'WolframAlpha'}
                  </button>
                </div>
                <div className="cell-actions-right">
                  {isMobile ? (
                    <div className="more-wrapper">
                      <button className="ghost-button more-button" onClick={() => setMoreOpenId(moreOpenId === cell.id ? null : cell.id)}>⋮</button>
                      {moreOpenId === cell.id ? (
                        <div className="more-menu">
                          <button onClick={() => { duplicateCell(index); setMoreOpenId(null)}}>Duplicate</button>
                          <button onClick={() => { deleteCell(index); setMoreOpenId(null)}}>Delete</button>
                          <button onClick={() => { index > 0 && moveCell(index, index - 1); setMoreOpenId(null)}}>Up</button>
                          <button onClick={() => { index < cells.length - 1 && moveCell(index, index + 1); setMoreOpenId(null)}}>Down</button>
                        </div>
                      ) : null}
                      <button type="button" className="run-button" onClick={() => void runCell(cell.id)}>
                        {cell.isRunning ? 'Running…' : '▶ Run'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="ghost-button" onClick={() => duplicateCell(index)}>Duplicate</button>
                      <button type="button" className="ghost-button" onClick={() => deleteCell(index)}>Delete</button>
                      <button type="button" className="ghost-button" onClick={() => index > 0 && moveCell(index, index - 1)}>Up</button>
                      <button type="button" className="ghost-button" onClick={() => index < cells.length - 1 && moveCell(index, index + 1)}>Down</button>
                      <button type="button" className="run-button" onClick={() => void runCell(cell.id)}>
                        {cell.isRunning ? 'Running…' : '▶ Run'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <textarea
                ref={(el) => { textareaRefs.current[cell.id] = el }}
                value={cell.code}
                onChange={(event) => updateCell(cell.id, { code: event.target.value })}
                onFocus={() => setActiveCellId(cell.id)}
                spellCheck="false"
                placeholder="Enter a CAS command"
              />
              <div className="output-card">
                <div className="cell-header">
                  <span className="cell-index">Out [{index + 1}]:</span>
                </div>
                {cell.isRunning ? (
                  <div className="running-row"><span className="spinner" /> Executing...</div>
                ) : (
                  <>
                    <pre className={cell.backend === 'wolframalpha' ? 'wolfram-output-text' : ''}>{cell.output}</pre>
                    {cell.backend === 'wolframalpha' && cell.images?.length ? (
                      <div className="wolfram-image-grid">
                        {cell.images.map((image, idx) => (
                          <figure key={idx} className="wolfram-image-card">
                            <button type="button" className="image-expand-button" onClick={() => setSelectedImage(image)}>
                              <img src={image.src} alt={image.alt} />
                            </button>
                            <figcaption>{image.title}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
                {cell.error ? <p className="error-text">{cell.error}</p> : null}
              </div>
              <div className="cell-addbar" onClick={() => addCellBelowAt(index)} title="Add cell below">＋</div>
            </section>
          )
        })}

        <div className="cell-summary">{activeCellCount} cell(s) loaded</div>

        {selectedImage ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedImage(null)}>
            <div className="image-modal" onClick={(e) => e.stopPropagation()}>
              <button className="image-modal-close" onClick={() => setSelectedImage(null)}>×</button>
              <img src={selectedImage.src} alt={selectedImage.alt} />
              <div className="image-modal-caption">{selectedImage.title}</div>
            </div>
          </div>
        ) : null}

        {showSettings ? (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>Settings</h3>
              <div className="settings-row">
                <label>Default backend</label>
                <select
                  value={settings.defaultBackend}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultBackend: e.target.value as Settings['defaultBackend'] }))}
                >
                  <option value="local">Local CAS</option>
                  <option value="wolframalpha">WolframAlpha</option>
                </select>
              </div>

              <div className="settings-row">
                <label>Run shortcut</label>
                <div className="key-capture-row">
                  <button className="secondary-button" onClick={() => setCapturingRun(true)}>
                    {capturingRun ? 'Press keys…' : settings.runShortcut}
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <label>Add cell shortcut</label>
                <div className="key-capture-row">
                  <button className="secondary-button" onClick={() => setCapturingAdd(true)}>
                    {capturingAdd ? 'Press keys…' : settings.addCellShortcut}
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowSettings(false)}>Close</button>
              </div>
            </div>
          </div>
        ) : null}
        {loginOpen ? (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>Login (username only)</h3>
              <div className="settings-row">
                <label>Username</label>
                <input type="text" onChange={(e) => setUserName(e.target.value)} defaultValue={userName ?? ''} />
              </div>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setLoginOpen(false)}>Cancel</button>
                <button className="secondary-button" onClick={() => userName && doLogin(userName)}>Login</button>
              </div>
            </div>
          </div>
        ) : null}

        {dashboardOpen ? (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>Dashboard — {userName}</h3>
              <div className="settings-row">
                <label>Create project</label>
                <CreateProject onCreate={async (name) => { await createProjectRemote(name); }} />
              </div>
              <div className="settings-row">
                <label>Existing projects</label>
                <div className="projects-list">
                  {projects.length === 0 ? <p>No projects yet</p> : projects.map((p) => (
                    <div key={p} className="project-row">
                      <button className="secondary-button" onClick={() => loadProjectRemote(p)}>{p}</button>
                      <button className="ghost-button" onClick={() => { const newName = prompt('Rename to', p); if (newName) renameProjectRemote(p, newName) }}>Rename</button>
                      <button className="ghost-button" onClick={() => { if (confirm('Delete project?')) deleteProjectRemote(p) }}>Delete</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setDashboardOpen(false)}>Close</button>
                {currentProject ? <button className="secondary-button" onClick={() => saveProjectRemote(currentProject)}>Save Project</button> : null}
              </div>
            </div>
          </div>
        ) : null}
        {isMobile ? (
          <button className="fab" onClick={() => addCell('bottom')} aria-label="Add cell">＋</button>
        ) : null}

        {keyboardVisible && activeCellId ? (
          <>
            <div className="floating-run">
              <button className="run-button" onClick={() => activeCellId && runCell(activeCellId)}>▶ Run</button>
            </div>
            <div className="input-helper-bar">
              <button onClick={() => insertSymbolToActive('π')}>π</button>
              <button onClick={() => insertSymbolToActive('^')}>^</button>
              <button onClick={() => insertSymbolToActive('√(')}>√</button>
              <button onClick={() => insertSymbolToActive('∑')}>∑</button>
              <button onClick={() => insertSymbolToActive('->')}>→</button>
              <button onClick={() => insertSymbolToActive('=')}>=</button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}

export default App
