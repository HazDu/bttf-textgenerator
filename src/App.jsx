import { useEffect, useId, useState } from 'react'
import './App.css'

const defaultText = 'BACK\nTO THE FUTURE'

const initialState = {
  text: defaultText,
  width: 1600,
  height: 900,
  padding: 96,
  fontSize: 150,
  lineHeight: 0.9,
  letterSpacing: 4,
  align: 'center',
  backgroundMode: 'transparent',
  backgroundColor1: '#050816',
  backgroundColor2: '#1b365d',
  backgroundAngle: 90,
  fillMode: 'gradient',
  fillColor1: '#ffe66d',
  fillColor2: '#ff7b00',
  fillAngle: 90,
  outlineEnabled: true,
  outlineWidth: 16,
  outlineMode: 'gradient',
  outlineColor1: '#fff3bf',
  outlineColor2: '#ff2f00',
  outlineAngle: 90,
  shadowEnabled: true,
  shadowBlur: 18,
  shadowOffsetX: 18,
  shadowOffsetY: 18,
  shadowOpacity: 0.7,
  shadowMode: 'gradient',
  shadowColor1: '#ff7b00',
  shadowColor2: '#7a0000',
  shadowAngle: 90,
  jpgBackground: '#050816',
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized

  const value = Number.parseInt(full, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function colorWithOpacity(hex, opacity) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity, 0, 1)})`
}

function gradientVector(angle) {
  const radians = (angle * Math.PI) / 180
  const x = Math.cos(radians) * 0.5
  const y = Math.sin(radians) * 0.5

  return {
    x1: 0.5 - x,
    y1: 0.5 - y,
    x2: 0.5 + x,
    y2: 0.5 + y,
  }
}

function buildGradient(id, angle, start, end, opacity = 1) {
  const vector = gradientVector(angle)
  const stopOne = opacity === 1 ? start : colorWithOpacity(start, opacity)
  const stopTwo = opacity === 1 ? end : colorWithOpacity(end, opacity)

  return `
    <linearGradient id="${id}" x1="${vector.x1}" y1="${vector.y1}" x2="${vector.x2}" y2="${vector.y2}">
      <stop offset="0%" stop-color="${stopOne}" />
      <stop offset="100%" stop-color="${stopTwo}" />
    </linearGradient>
  `
}

function getPaint(mode, id, color) {
  return mode === 'gradient' ? `url(#${id})` : color
}

function buildSvgMarkup(state, fontDataUrl, suffix) {
  const lines = state.text.split('\n')
  const safeLines = lines.length > 0 ? lines : ['']
  const lineAdvance = state.fontSize * state.lineHeight
  const totalBlockHeight = lineAdvance * (safeLines.length - 1)
  const baselineOffset = state.fontSize * 0.76
  const startY = state.height / 2 - totalBlockHeight / 2 + baselineOffset
  const textAnchor = state.align === 'left' ? 'start' : state.align === 'right' ? 'end' : 'middle'
  const x = state.align === 'left' ? state.padding : state.align === 'right' ? state.width - state.padding : state.width / 2

  const fillGradientId = `fillGradient-${suffix}`
  const outlineGradientId = `outlineGradient-${suffix}`
  const shadowGradientId = `shadowGradient-${suffix}`
  const backgroundGradientId = `backgroundGradient-${suffix}`
  const shadowFilterId = `shadowFilter-${suffix}`

  const defs = []

  if (fontDataUrl) {
    defs.push(`
      <style>
        @font-face {
          font-family: 'BTTF Generator';
          src: url('${fontDataUrl}') format('truetype');
        }

        text {
          font-family: 'BTTF Generator';
        }
      </style>
    `)
  }

  if (state.backgroundMode === 'gradient') {
    defs.push(buildGradient(backgroundGradientId, state.backgroundAngle, state.backgroundColor1, state.backgroundColor2))
  }

  if (state.fillMode === 'gradient') {
    defs.push(buildGradient(fillGradientId, state.fillAngle, state.fillColor1, state.fillColor2))
  }

  if (state.outlineEnabled && state.outlineMode === 'gradient') {
    defs.push(buildGradient(outlineGradientId, state.outlineAngle, state.outlineColor1, state.outlineColor2))
  }

  if (state.shadowEnabled && state.shadowMode === 'gradient') {
    defs.push(
      buildGradient(
        shadowGradientId,
        state.shadowAngle,
        state.shadowColor1,
        state.shadowColor2,
        state.shadowOpacity,
      ),
    )
  }

  if (state.shadowEnabled && state.shadowBlur > 0) {
    defs.push(`
      <filter id="${shadowFilterId}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${state.shadowBlur}" />
      </filter>
    `)
  }

  const shadowPaint = getPaint(
    state.shadowMode,
    shadowGradientId,
    colorWithOpacity(state.shadowColor1, state.shadowOpacity),
  )
  const fillPaint = getPaint(state.fillMode, fillGradientId, state.fillColor1)
  const outlinePaint = getPaint(state.outlineMode, outlineGradientId, state.outlineColor1)

  const tspans = safeLines
    .map((line, index) => {
      const y = startY + index * lineAdvance
      return `<tspan x="${x}" y="${y}">${escapeXml(line || ' ')}</tspan>`
    })
    .join('')

  const backgroundMarkup =
    state.backgroundMode === 'transparent'
      ? ''
      : `<rect width="100%" height="100%" fill="${
          state.backgroundMode === 'gradient'
            ? `url(#${backgroundGradientId})`
            : state.backgroundColor1
        }" />`

  const shadowMarkup =
    state.shadowEnabled
      ? `
        <text
          x="${x}"
          y="${startY}"
          text-anchor="${textAnchor}"
          font-size="${state.fontSize}"
          letter-spacing="${state.letterSpacing}"
          filter="${state.shadowBlur > 0 ? `url(#${shadowFilterId})` : ''}"
          transform="translate(${state.shadowOffsetX} ${state.shadowOffsetY})"
          fill="${shadowPaint}"
          stroke="none"
        >${tspans}</text>
      `
      : ''

  const outlineMarkup =
    state.outlineEnabled && state.outlineWidth > 0
      ? `stroke="${outlinePaint}" stroke-width="${state.outlineWidth}" stroke-linejoin="round" paint-order="stroke fill"`
      : 'stroke="none"'

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${state.width}" height="${state.height}" viewBox="0 0 ${state.width} ${state.height}">
      <defs>${defs.join('')}</defs>
      ${backgroundMarkup}
      ${shadowMarkup}
      <text
        x="${x}"
        y="${startY}"
        text-anchor="${textAnchor}"
        font-size="${state.fontSize}"
        letter-spacing="${state.letterSpacing}"
        fill="${fillPaint}"
        ${outlineMarkup}
      >${tspans}</text>
    </svg>
  `
}

function downloadFile(url, name) {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
}

async function svgToCanvas(svgMarkup, width, height, scale, format, jpgBackground) {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const blobUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = reject
      nextImage.src = blobUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale

    const context = canvas.getContext('2d')
    context.scale(scale, scale)

    if (format === 'jpg') {
      context.fillStyle = jpgBackground
      context.fillRect(0, 0, width, height)
    }

    context.drawImage(image, 0, 0, width, height)

    return canvas
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

function NumberInput({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label className="control">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ColorModeControls({
  title,
  mode,
  onModeChange,
  color1,
  color2,
  angle,
  onColor1Change,
  onColor2Change,
  onAngleChange,
  includeTransparent = false,
}) {
  return (
    <section className="panel-section">
      <div className="section-title-row">
        <h3>{title}</h3>
        <select value={mode} onChange={(event) => onModeChange(event.target.value)}>
          {includeTransparent ? <option value="transparent">Transparent</option> : null}
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>
      </div>
      {mode !== 'transparent' ? (
        <div className="grid two-up compact">
          <label className="control">
            <span>{mode === 'gradient' ? 'Start' : 'Color'}</span>
            <input type="color" value={color1} onChange={(event) => onColor1Change(event.target.value)} />
          </label>
          {mode === 'gradient' ? (
            <>
              <label className="control">
                <span>End</span>
                <input type="color" value={color2} onChange={(event) => onColor2Change(event.target.value)} />
              </label>
              <NumberInput label="Angle" value={angle} min={0} max={360} onChange={onAngleChange} />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function App() {
  const [state, setState] = useState(initialState)
  const [exportScale, setExportScale] = useState(2)
  const [exporting, setExporting] = useState('')
  const [fontDataUrl, setFontDataUrl] = useState('')
  const svgId = useId().replaceAll(':', '')

  useEffect(() => {
    let active = true

    async function loadFont() {
      const fontFace = new FontFace('BTTF Generator', 'url(/BTTF.ttf)')
      await fontFace.load()
      document.fonts.add(fontFace)

      const response = await fetch('/BTTF.ttf')
      const blob = await response.blob()

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      if (active) {
        setFontDataUrl(dataUrl)
      }
    }

    loadFont().catch((error) => {
      console.error('Failed to load font', error)
    })

    return () => {
      active = false
    }
  }, [])

  const svgMarkup = buildSvgMarkup(state, fontDataUrl, svgId)

  function patchState(key, value) {
    setState((current) => ({ ...current, [key]: value }))
  }

  async function handleDownload(format) {
    const filenameBase = state.text
      .split('\n')
      .join(' ')
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'bttf-export'

    setExporting(format)

    try {
      if (format === 'svg') {
        const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)
        downloadFile(svgUrl, `${filenameBase}-${state.width}x${state.height}.svg`)
        setTimeout(() => URL.revokeObjectURL(svgUrl), 0)
        return
      }

      const canvas = await svgToCanvas(
        svgMarkup,
        state.width,
        state.height,
        exportScale,
        format,
        state.jpgBackground,
      )

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
      const quality = format === 'jpg' ? 0.95 : undefined
      const url = canvas.toDataURL(mimeType, quality)
      downloadFile(url, `${filenameBase}-${state.width * exportScale}x${state.height * exportScale}.${format}`)
    } finally {
      setExporting('')
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">BTTF title builder</p>
          <h1>Build a stylized logo image from the supplied `BTTF.ttf`.</h1>
          <p className="lede">
            The font file is usable for this project. It is a TrueType font, so the browser can load it,
            preview it, and embed it into the exported SVG.
          </p>
        </div>
        <div className="hero-meta">
          <div>
            <span>Base size</span>
            <strong>
              {state.width} x {state.height}
            </strong>
          </div>
          <div>
            <span>Raster export</span>
            <strong>
              {state.width * exportScale} x {state.height * exportScale}
            </strong>
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="controls">
          <section className="panel-section">
            <h3>Text</h3>
            <label className="control">
              <span>Headline</span>
              <textarea
                rows="4"
                value={state.text}
                onChange={(event) => patchState('text', event.target.value)}
              />
            </label>
            <div className="grid two-up">
              <NumberInput label="Width" value={state.width} min={256} max={5000} onChange={(value) => patchState('width', value)} />
              <NumberInput label="Height" value={state.height} min={256} max={5000} onChange={(value) => patchState('height', value)} />
              <NumberInput label="Padding" value={state.padding} min={0} max={400} onChange={(value) => patchState('padding', value)} />
              <NumberInput label="Font size" value={state.fontSize} min={24} max={600} onChange={(value) => patchState('fontSize', value)} />
              <NumberInput label="Line height" value={state.lineHeight} min={0.6} max={2} step={0.05} onChange={(value) => patchState('lineHeight', value)} />
              <NumberInput label="Letter spacing" value={state.letterSpacing} min={-10} max={40} step={0.5} onChange={(value) => patchState('letterSpacing', value)} />
            </div>
            <label className="control">
              <span>Alignment</span>
              <select value={state.align} onChange={(event) => patchState('align', event.target.value)}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </section>

          <ColorModeControls
            title="Background"
            mode={state.backgroundMode}
            onModeChange={(value) => patchState('backgroundMode', value)}
            color1={state.backgroundColor1}
            color2={state.backgroundColor2}
            angle={state.backgroundAngle}
            onColor1Change={(value) => patchState('backgroundColor1', value)}
            onColor2Change={(value) => patchState('backgroundColor2', value)}
            onAngleChange={(value) => patchState('backgroundAngle', value)}
            includeTransparent
          />

          <ColorModeControls
            title="Fill"
            mode={state.fillMode}
            onModeChange={(value) => patchState('fillMode', value)}
            color1={state.fillColor1}
            color2={state.fillColor2}
            angle={state.fillAngle}
            onColor1Change={(value) => patchState('fillColor1', value)}
            onColor2Change={(value) => patchState('fillColor2', value)}
            onAngleChange={(value) => patchState('fillAngle', value)}
          />

          <section className="panel-section">
            <div className="section-title-row">
              <h3>Outline</h3>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={state.outlineEnabled}
                  onChange={(event) => patchState('outlineEnabled', event.target.checked)}
                />
                <span>Enable</span>
              </label>
            </div>
            {state.outlineEnabled ? (
              <>
                <NumberInput
                  label="Stroke width"
                  value={state.outlineWidth}
                  min={0}
                  max={80}
                  onChange={(value) => patchState('outlineWidth', value)}
                />
                <ColorModeControls
                  title="Outline color"
                  mode={state.outlineMode}
                  onModeChange={(value) => patchState('outlineMode', value)}
                  color1={state.outlineColor1}
                  color2={state.outlineColor2}
                  angle={state.outlineAngle}
                  onColor1Change={(value) => patchState('outlineColor1', value)}
                  onColor2Change={(value) => patchState('outlineColor2', value)}
                  onAngleChange={(value) => patchState('outlineAngle', value)}
                />
              </>
            ) : null}
          </section>

          <section className="panel-section">
            <div className="section-title-row">
              <h3>Shadow</h3>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={state.shadowEnabled}
                  onChange={(event) => patchState('shadowEnabled', event.target.checked)}
                />
                <span>Enable</span>
              </label>
            </div>
            {state.shadowEnabled ? (
              <>
                <div className="grid two-up">
                  <NumberInput
                    label="Offset X"
                    value={state.shadowOffsetX}
                    min={-200}
                    max={200}
                    onChange={(value) => patchState('shadowOffsetX', value)}
                  />
                  <NumberInput
                    label="Offset Y"
                    value={state.shadowOffsetY}
                    min={-200}
                    max={200}
                    onChange={(value) => patchState('shadowOffsetY', value)}
                  />
                  <NumberInput
                    label="Blur"
                    value={state.shadowBlur}
                    min={0}
                    max={80}
                    onChange={(value) => patchState('shadowBlur', value)}
                  />
                  <NumberInput
                    label="Opacity"
                    value={state.shadowOpacity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(value) => patchState('shadowOpacity', value)}
                  />
                </div>
                <ColorModeControls
                  title="Shadow color"
                  mode={state.shadowMode}
                  onModeChange={(value) => patchState('shadowMode', value)}
                  color1={state.shadowColor1}
                  color2={state.shadowColor2}
                  angle={state.shadowAngle}
                  onColor1Change={(value) => patchState('shadowColor1', value)}
                  onColor2Change={(value) => patchState('shadowColor2', value)}
                  onAngleChange={(value) => patchState('shadowAngle', value)}
                />
              </>
            ) : null}
          </section>

          <section className="panel-section">
            <h3>Export</h3>
            <div className="grid two-up">
              <label className="control">
                <span>Scale</span>
                <select value={exportScale} onChange={(event) => setExportScale(Number(event.target.value))}>
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="3">3x</option>
                  <option value="4">4x</option>
                </select>
              </label>
              <label className="control">
                <span>JPG background</span>
                <input
                  type="color"
                  value={state.jpgBackground}
                  onChange={(event) => patchState('jpgBackground', event.target.value)}
                />
              </label>
            </div>
            <div className="export-actions">
              <button type="button" onClick={() => handleDownload('png')} disabled={!fontDataUrl || exporting !== ''}>
                {exporting === 'png' ? 'Rendering PNG...' : 'Download PNG'}
              </button>
              <button type="button" onClick={() => handleDownload('jpg')} disabled={!fontDataUrl || exporting !== ''}>
                {exporting === 'jpg' ? 'Rendering JPG...' : 'Download JPG'}
              </button>
              <button type="button" onClick={() => handleDownload('svg')} disabled={!fontDataUrl || exporting !== ''}>
                {exporting === 'svg' ? 'Packing SVG...' : 'Download SVG'}
              </button>
            </div>
          </section>
        </aside>

        <section className="preview-panel">
          <div className="preview-frame">
            <div
              className="preview-surface"
              style={{ aspectRatio: `${state.width} / ${state.height}` }}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
