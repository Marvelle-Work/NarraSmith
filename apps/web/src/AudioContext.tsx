import { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react'

type AudioState = {
  isPlaying: boolean
  currentUrl: string | null
  currentTitle: string | null
  volume: number
  play: (url: string, title?: string) => void
  pause: () => void
  toggle: () => void
  setVolume: (v: number) => void
}

const AudioCtx = createContext<AudioState>({
  isPlaying: false,
  currentUrl: null,
  currentTitle: null,
  volume: 0.7,
  play: () => {},
  pause: () => {},
  toggle: () => {},
  setVolume: () => {},
})

export function useAudio() {
  return useContext(AudioCtx)
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [volume, setVolumeState] = useState(0.7)

  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.volume = 0.7
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => setIsPlaying(false)
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [])

  const play = useCallback((url: string, title?: string) => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.src !== url) {
      audio.src = url
      audio.load()
    }
    audio.play().then(() => {
      setIsPlaying(true)
      setCurrentUrl(url)
      setCurrentTitle(title ?? null)
    }).catch(() => {})
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentUrl) return
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [currentUrl])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
  }, [])

  return (
    <AudioCtx.Provider value={{ isPlaying, currentUrl, currentTitle, volume, play, pause, toggle, setVolume }}>
      {children}
    </AudioCtx.Provider>
  )
}
