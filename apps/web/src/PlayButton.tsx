import { useAudio } from './AudioContext'
import { parseMediaSource, mediaLabel } from './mediaSource'

type Props = {
  url: string
  title?: string
}

export function PlayButton({ url, title }: Props) {
  const { play, stop, isPlaying, currentUrl } = useAudio()
  const source = parseMediaSource(url)
  const label = mediaLabel(source)

  // For embed types (Spotify), active = currently loaded, regardless of isPlaying
  // For direct audio, active = loaded AND playing
  const isActive = source.type === 'spotify'
    ? currentUrl === url
    : currentUrl === url && isPlaying

  return (
    <button
      onClick={() => isActive ? stop() : play(url, title)}
      title={isActive ? 'Stop' : `Play (${label})`}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: isActive ? '#dc2626' : '#6366f1',
        fontSize: 11, fontWeight: 700, padding: '0 2px',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      {isActive ? 'Stop' : 'Play'}
    </button>
  )
}
