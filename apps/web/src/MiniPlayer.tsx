import { useAudio } from './AudioContext'

export function MiniPlayer() {
  const { isPlaying, currentUrl, currentTitle, volume, toggle, setVolume } = useAudio()

  if (!currentUrl) return null

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 3000,
      background: '#18181b', color: '#fff', borderRadius: 10,
      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
      minWidth: 200, maxWidth: 320,
    }}>
      <button onClick={toggle} style={playBtn}>
        {isPlaying ? '||' : '|>'}
      </button>
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {currentTitle || 'Playing'}
        </div>
        {isPlaying && (
          <div style={{ fontSize: 10, color: '#a1a1aa' }}>Now playing</div>
        )}
      </div>
      <input
        type="range"
        min={0} max={1} step={0.05}
        value={volume}
        onChange={e => setVolume(Number(e.target.value))}
        style={{ width: 60, accentColor: '#6366f1', cursor: 'pointer' }}
        title={`Volume: ${Math.round(volume * 100)}%`}
      />
    </div>
  )
}

const playBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: '50%',
  border: '2px solid #6366f1', background: 'transparent',
  color: '#6366f1', fontWeight: 700, fontSize: 11,
  cursor: 'pointer', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  letterSpacing: -1,
}
