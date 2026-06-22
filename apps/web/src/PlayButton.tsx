import { useAudio } from './AudioContext'

type Props = {
  url: string
  title?: string
}

export function PlayButton({ url, title }: Props) {
  const { play, pause, isPlaying, currentUrl } = useAudio()
  const isThis = currentUrl === url && isPlaying

  return (
    <button
      onClick={() => isThis ? pause() : play(url, title)}
      title={isThis ? 'Pause' : 'Play'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: isThis ? '#dc2626' : '#6366f1',
        fontSize: 11, fontWeight: 700, padding: '0 2px',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      {isThis ? 'Stop' : 'Play'}
    </button>
  )
}
