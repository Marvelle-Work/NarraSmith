import { useRef, useState } from 'react'

type Props = {
  json: string
  fileName: string
  onDownload: () => void
  onClose: () => void
}

export function ExportModal({ json, fileName, onDownload, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleCopy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = () => {
    onDownload()
    onClose()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={modal}>
        <h2 style={heading}>Export Project</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#71717a' }}>{fileName}</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={handleDownload} style={primaryBtn}>
            Download File
          </button>
          <button onClick={handleCopy} style={secondaryBtn}>
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
        </div>

        <textarea
          ref={textareaRef}
          readOnly
          value={json}
          onFocus={() => textareaRef.current?.select()}
          style={textareaStyle}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={cancelBtn}>Close</button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.4)',
}

const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '28px 32px',
  width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  fontFamily: 'system-ui, sans-serif',
}

const heading: React.CSSProperties = {
  margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#18181b',
}

const textareaStyle: React.CSSProperties = {
  flex: 1, minHeight: 200, maxHeight: 400,
  padding: '10px 12px', border: '1px solid #d4d4d8', borderRadius: 6,
  fontSize: 12, fontFamily: 'monospace', color: '#18181b', background: '#fafafa',
  resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6,
  border: 'none', background: '#18181b', color: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6,
  border: '1px solid #d4d4d8', background: '#fff', color: '#18181b',
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
}

const cancelBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 6,
  border: '1px solid #d4d4d8', background: '#fff',
  color: '#52525b', fontWeight: 600, fontSize: 13,
  cursor: 'pointer',
}
