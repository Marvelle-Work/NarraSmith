export const SWATCHES = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#18181b', '#71717a', '#ffffff',
]

export function ColorPicker({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <button title="Default" onClick={() => onChange('')} style={{
        width: 22, height: 22, borderRadius: '50%', padding: 0, cursor: 'pointer',
        background: '#fff', fontSize: 12, color: '#a1a1aa',
        border: !value ? '2.5px solid #18181b' : '1.5px solid #d4d4d8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>×</button>

      {SWATCHES.map(s => {
        const isWhite = s === '#ffffff'
        const isSelected = value === s
        return (
          <button key={s} title={s} onClick={() => onChange(s)} style={{
            width: 22, height: 22, borderRadius: '50%', padding: 0,
            background: s, cursor: 'pointer',
            border: isSelected ? '2.5px solid #18181b' : isWhite ? '1.5px solid #d4d4d8' : '2px solid transparent',
            outline: isSelected ? '2px solid #fff' : 'none',
            outlineOffset: -3, boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }} />
        )
      })}

      <label title="Custom colour" style={{ cursor: 'pointer', display: 'flex' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)',
          border: (value && !SWATCHES.includes(value)) ? '2.5px solid #18181b' : '1.5px solid #d4d4d8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
        <input
          type="color"
          value={value?.startsWith('#') ? value : '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  )
}
