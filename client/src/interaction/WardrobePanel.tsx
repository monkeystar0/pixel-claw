import { useState, useCallback, useRef, useEffect } from 'react'
import type { PlayerAppearance } from '../world/engine/player.js'
import { saveAppearance } from '../world/engine/player.js'
import { PALETTE_COUNT } from '../world/constants.js'
import { getCharacterSprites } from '../world/sprites/spriteData.js'
import { getCachedSprite } from '../world/sprites/spriteCache.js'
import { Direction } from '../world/types.js'

interface WardrobePanelProps {
  appearance: PlayerAppearance
  onChangeAppearance: (appearance: PlayerAppearance) => void
  onClose: () => void
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 340,
  background: '#1a1a2e',
  border: '2px solid #4a4a6a',
  borderRadius: 2,
  fontFamily: 'monospace',
  color: '#e0e0e0',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#252540',
  borderBottom: '1px solid #4a4a6a',
}

const sectionStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
}

const PALETTE_COLORS = [
  '#e8c8a0', '#c8a878', '#d4a870', '#a88860', '#987860', '#886850',
]

export function WardrobePanel({ appearance, onChangeAppearance, onClose }: WardrobePanelProps) {
  const [palette, setPalette] = useState(appearance.palette)
  const [hueShift, setHueShift] = useState(appearance.hueShift)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const apply = useCallback((newPalette: number, newHue: number) => {
    const newAppearance = { palette: newPalette, hueShift: newHue }
    onChangeAppearance(newAppearance)
    saveAppearance(newAppearance)
  }, [onChangeAppearance])

  const handlePaletteChange = useCallback((p: number) => {
    setPalette(p)
    apply(p, hueShift)
  }, [hueShift, apply])

  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseInt(e.target.value, 10)
    setHueShift(h)
    apply(palette, h)
  }, [palette, apply])

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const zoom = 4
    canvas.width = 16 * zoom
    canvas.height = 32 * zoom
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    try {
      const sprites = getCharacterSprites(palette, hueShift)
      const frame = sprites.walk[Direction.DOWN][1]
      const cached = getCachedSprite(frame, zoom)
      ctx.drawImage(cached, 0, 0)
    } catch {
      ctx.fillStyle = '#333'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#666'
      ctx.font = '10px monospace'
      ctx.fillText('?', 24, 60)
    }
  }, [palette, hueShift])

  return (
    <div style={panelStyle} onClick={e => e.stopPropagation()}>
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Wardrobe</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #5a5a7a',
            color: '#aaa',
            cursor: 'pointer',
            padding: '2px 6px',
            fontFamily: 'monospace',
            fontSize: 11,
            borderRadius: 2,
          }}
        >
          ESC
        </button>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: 16,
        background: '#0a0a14',
      }}>
        <canvas
          ref={previewRef}
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Skin</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: PALETTE_COUNT }, (_, i) => (
            <button
              key={i}
              onClick={() => handlePaletteChange(i)}
              style={{
                width: 28,
                height: 28,
                background: PALETTE_COLORS[i] || '#666',
                border: palette === i ? '2px solid #4a9eff' : '2px solid #3a3a5a',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'border-color 0.1s',
              }}
            />
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Hue Shift: {hueShift}°</div>
        <input
          type="range"
          min="0"
          max="360"
          value={hueShift}
          onChange={handleHueChange}
          style={{ width: '100%', accentColor: '#4a9eff' }}
        />
      </div>

      <div style={{ padding: '8px 12px', textAlign: 'center' }}>
        <button
          onClick={onClose}
          style={{
            padding: '6px 24px',
            background: '#2a4a7a',
            border: '1px solid #4a6a9a',
            borderRadius: 2,
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
