import { useState } from 'react'
import { useAudio } from './AudioContext'
import { mediaLabel } from './mediaSource'

export function MiniPlayer() {
  const { isPlaying, currentUrl, currentTitle, mediaSource, volume, toggle, setVolume, stop } = useAudio()
  const [expanded, setExpanded] = useState(false)

  if (!currentUrl || !mediaSource) return null

  const label = mediaLabel(mediaSource)
  const showEmbed = mediaSource.type !== 'direct'

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 3000,
      background: '#18181b', color: '#fff', borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      width: expanded && showEmbed ? 320 : undefined,
      minWidth: 200, maxWidth: 360,
    }}>
      {/* Embed area — stays mounted once created, hidden via CSS to preserve playback */}
      {mediaSource.type === 'youtube' && (
        <div style={{
          height: expanded ? 180 : 0,
          overflow: 'hidden',
          transition: 'height 0.2s ease',
        }}>
          <iframe
            src={`https://www.youtube.com/embed/${mediaSource.videoId}?autoplay=1&rel=0`}
            style={{ width: '100%', height: 180, border: 'none' }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
      {mediaSource.type === 'spotify' && (
        <div style={{
          height: expanded ? 152 : 0,
          overflow: 'hidden',
          transition: 'height 0.2s ease',
          position: 'relative',
        }}>
          <iframe
            src={`https://open.spotify.com/embed/${mediaSource.kind}/${mediaSource.id}?theme=0`}
            style={{ width: '100%', height: 152, border: 'none' }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
      )}

      {/* Controls bar */}
      <div style={{
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {mediaSource.type === 'direct' ? (
          <button onClick={toggle} style={playBtn}>
            {isPlaying ? '||' : '|>'}
          </button>
        ) : (
          <button
            onClick={() => setExpanded(e => !e)}
            style={playBtn}
            title={expanded ? 'Collapse' : 'Expand player'}
          >
            {expanded ? '_' : '|>'}
          </button>
        )}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#fff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentTitle || 'Playing'}
          </div>
          <div style={{ fontSize: 10, color: '#a1a1aa' }}>
            {mediaSource.type === 'direct' && isPlaying
              ? `${label} — Now playing`
              : mediaSource.type === 'spotify' && !expanded
                ? 'Click to open player'
                : label}
          </div>
        </div>
        {mediaSource.type === 'direct' && (
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            style={{ width: 60, accentColor: '#6366f1', cursor: 'pointer' }}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        )}
        {mediaSource.type === 'spotify' && (
          <a
            href={mediaSource.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: '#1db954', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}
          >
            Open in Spotify
          </a>
        )}
        <button onClick={stop} style={closeBtn} title="Close player">x</button>
      </div>
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

const closeBtn: React.CSSProperties = {
  width: 20, height: 20, borderRadius: '50%',
  border: 'none', background: '#27272a',
  color: '#71717a', fontWeight: 700, fontSize: 10,
  cursor: 'pointer', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
