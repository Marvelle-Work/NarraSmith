import { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react'
import { parseMediaSource, type MediaSource } from './mediaSource'

type AudioState = {
  isPlaying: boolean
  currentUrl: string | null
  currentTitle: string | null
  mediaSource: MediaSource | null
  volume: number
  play: (url: string, title?: string) => void
  pause: () => void
  toggle: () => void
  setVolume: (v: number) => void
  stop: () => void
}

const AudioCtx = createContext<AudioState>({
  isPlaying: false,
  currentUrl: null,
  currentTitle: null,
  mediaSource: null,
  volume: 0.7,
  play: () => {},
  pause: () => {},
  toggle: () => {},
  setVolume: () => {},
  stop: () => {},
})

export function useAudio() {
  return useContext(AudioCtx)
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [mediaSource, setMediaSource] = useState<MediaSource | null>(null)
  const [volume, setVolumeState] = useState(0.7)

  useEffect(() => {
    const audio = new Audio()
    audio.volume = 0.7
    audioRef.current = audio
    const onEnded = () => setIsPlaying(false)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
    }
  }, [])

  const stopDirect = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
  }, [])

  const play = useCallback((url: string, title?: string) => {
    const source = parseMediaSource(url)

    // Stop any current direct audio when switching
    stopDirect()

    setCurrentUrl(url)
    setCurrentTitle(title ?? null)
    setMediaSource(source)

    if (source.type === 'direct') {
      const audio = audioRef.current
      if (!audio) return
      audio.src = url
      audio.load()
      audio.play().then(() => setIsPlaying(true)).catch(() => {})
    } else if (source.type === 'youtube') {
      setIsPlaying(true)
    }
    // Spotify: embed controls its own playback — no isPlaying state to set
  }, [stopDirect])

  const pause = useCallback(() => {
    if (mediaSource?.type === 'direct') {
      audioRef.current?.pause()
    }
    setIsPlaying(false)
  }, [mediaSource])

  const toggle = useCallback(() => {
    if (!currentUrl || !mediaSource) return
    if (mediaSource.type === 'direct') {
      const audio = audioRef.current
      if (!audio) return
      if (audio.paused) {
        audio.play().then(() => setIsPlaying(true)).catch(() => {})
      } else {
        audio.pause()
        setIsPlaying(false)
      }
    } else if (mediaSource.type === 'youtube') {
      setIsPlaying(p => !p)
    }
    // Spotify: playback controlled entirely by embed — toggle is a no-op
  }, [currentUrl, mediaSource])

  const stop = useCallback(() => {
    stopDirect()
    setIsPlaying(false)
    setCurrentUrl(null)
    setCurrentTitle(null)
    setMediaSource(null)
  }, [stopDirect])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
  }, [])

  return (
    <AudioCtx.Provider value={{ isPlaying, currentUrl, currentTitle, mediaSource, volume, play, pause, toggle, setVolume, stop }}>
      {children}
    </AudioCtx.Provider>
  )
}
