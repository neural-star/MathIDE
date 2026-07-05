import { useState } from 'react'

export default function Home({ onLogin, onCreate }: { onLogin: (name: string) => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  const [tab, setTab] = useState<'create' | 'login'>('create')

  const submit = () => {
    if (!name) return alert('Please enter a username')
    if (tab === 'create') onCreate(name)
    else onLogin(name)
  }

  return (
    <div className="home-page">
      <div className="home-grid">
        <div className="home-brand">
          <div className="logo-wrap">
            <svg width="80" height="80" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect width="64" height="64" rx="12" fill="#061228" />
              <text x="50%" y="52%" textAnchor="middle" fontSize="28" fontFamily="serif" fill="#7c3aed">∑</text>
            </svg>
            <div>
              <h1>MathIDE</h1>
              <p className="tagline">記号計算向けのインタラクティブノートブック</p>
            </div>
          </div>

          <div className="feature-cards">
            <div className="feature">
              <div className="feature-icon">📁</div>
              <div>
                <strong>プロジェクト保存</strong>
                <div className="muted">ユーザーごとのプロジェクト保存</div>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">📱</div>
              <div>
                <strong>モバイル対応</strong>
                <div className="muted">スワイプ、ドラッグ、補助ツールバー</div>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">⚙️</div>
              <div>
                <strong>複数バックエンド</strong>
                <div className="muted">ローカルCASとWolframAlpha</div>
              </div>
            </div>
          </div>

          <p className="about-note muted">MathIDEは軽量なアカウント（ユーザー名のみ）で素早く始められます。</p>
        </div>

        <div className="home-action-area">
          <div className="tabs">
            <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>新規登録</button>
            <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>ログイン</button>
          </div>

          <div className="form-card">
            <label className="field-label">ユーザー名</label>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ユーザー名" />
            <p className="muted micro">ユーザー名のみで軽量なアカウントを作成します。パスワードは不要です。</p>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="primary-button" style={{ flex: 1 }} onClick={submit}>{tab === 'create' ? 'アカウント作成' : 'ログイン'}</button>
              <button className="secondary-button" style={{ flex: 1 }} onClick={() => { setName(''); setTab('create') }}>クリア</button>
            </div>
          </div>

          <div className="home-about">
            <h4>できること</h4>
            <ul>
              <li>セルごとにCASコマンドを実行</li>
              <li>ユーザー名に紐づくプロジェクトの保存/読み込み</li>
              <li>モバイル向けの操作性（スワイプ/ドラッグ/補助バー）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
