export type MediaSource =
  | { type: 'direct'; url: string }
  | { type: 'youtube'; videoId: string; url: string }
  | { type: 'spotify'; id: string; kind: 'track' | 'album' | 'playlist'; url: string }

export function parseMediaSource(url: string): MediaSource {
  try {
    const u = new URL(url)

    // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      let videoId: string | null = null
      if (u.hostname === 'youtu.be') {
        videoId = u.pathname.slice(1)
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/')[2]
      } else {
        videoId = u.searchParams.get('v')
      }
      if (videoId) return { type: 'youtube', videoId, url }
    }

    // Spotify: open.spotify.com/track|album|playlist/ID
    if (u.hostname === 'open.spotify.com') {
      const parts = u.pathname.split('/')
      const kind = parts[1] as 'track' | 'album' | 'playlist'
      const id = parts[2]
      if (id && (kind === 'track' || kind === 'album' || kind === 'playlist')) {
        return { type: 'spotify', id, kind, url }
      }
    }
  } catch {}

  return { type: 'direct', url }
}

export function mediaLabel(source: MediaSource): string {
  switch (source.type) {
    case 'youtube': return 'YouTube'
    case 'spotify': return 'Spotify'
    case 'direct': return 'Audio'
  }
}
