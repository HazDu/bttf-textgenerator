import { useEffect, useId, useState } from 'react'
import './App.css'

const defaultText = 'INTO THE <\n> future'
const FONT_FAMILY = '"BTTF Generator", sans-serif'

const initialState = {
  text: defaultText,
  margin: 96,
  fontSize: 150,
  lineHeight: 1.1,
  letterSpacing: 4,
  backgroundMode: 'transparent',
  backgroundColor1: '#050816',
  backgroundColor2: '#1b365d',
  backgroundAngle: 90,
  fillMode: 'gradient',
  fillColor1: '#C31104',
  fillColor2: '#FEE137',
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

function getTextMetrics(context, text, fontSize) {
  const metrics = context.measureText(text)

  return {
    width: metrics.width,
    ascent: metrics.actualBoundingBoxAscent || fontSize * 0.76,
    descent: metrics.actualBoundingBoxDescent || fontSize * 0.24,
  }
}

function measureLayout(state) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const sourceLines = state.text.split('\n')
  const rawLines = sourceLines.length > 0 ? sourceLines : ['']
  const safeLetterSpacing = Number.isFinite(state.letterSpacing) ? state.letterSpacing : 0
  const lineAdvance = state.fontSize * state.lineHeight

  context.font = `${state.fontSize}px ${FONT_FAMILY}`

  const lines = rawLines.map((line, index) => {
    const metrics = getTextMetrics(context, line, state.fontSize)
    const graphemeCount = Array.from(line).length
    const spacingWidth = graphemeCount > 1 ? safeLetterSpacing * (graphemeCount - 1) : 0
    const width = Math.max(0, metrics.width + spacingWidth)
    const baselineY = index * lineAdvance

    return {
      text: line,
      width,
      baselineY,
      top: baselineY - metrics.ascent,
      bottom: baselineY + metrics.descent,
    }
  })

  const contentBounds = lines.reduce(
    (bounds, line) => ({
      minX: Math.min(bounds.minX, -line.width / 2),
      maxX: Math.max(bounds.maxX, line.width / 2),
      minY: Math.min(bounds.minY, line.top),
      maxY: Math.max(bounds.maxY, line.bottom),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  )

  const strokePadding = state.outlineEnabled ? state.outlineWidth / 2 : 0
  const textBounds = {
    minX: contentBounds.minX - strokePadding,
    maxX: contentBounds.maxX + strokePadding,
    minY: contentBounds.minY - strokePadding,
    maxY: contentBounds.maxY + strokePadding,
  }

  const blurPadding = state.shadowEnabled ? state.shadowBlur * 3 : 0
  const shadowBounds = state.shadowEnabled
    ? {
        minX: contentBounds.minX + state.shadowOffsetX - blurPadding,
        maxX: contentBounds.maxX + state.shadowOffsetX + blurPadding,
        minY: contentBounds.minY + state.shadowOffsetY - blurPadding,
        maxY: contentBounds.maxY + state.shadowOffsetY + blurPadding,
      }
    : textBounds

  const renderBounds = {
    minX: Math.min(textBounds.minX, shadowBounds.minX),
    maxX: Math.max(textBounds.maxX, shadowBounds.maxX),
    minY: Math.min(textBounds.minY, shadowBounds.minY),
    maxY: Math.max(textBounds.maxY, shadowBounds.maxY),
  }

  const width = Math.max(1, Math.ceil(renderBounds.maxX - renderBounds.minX + state.margin * 2))
  const height = Math.max(1, Math.ceil(renderBounds.maxY - renderBounds.minY + state.margin * 2))
  const centerX = state.margin - renderBounds.minX
  const offsetY = state.margin - renderBounds.minY

  return {
    width,
    height,
    centerX,
    lines: lines.map((line) => ({
      ...line,
      x: centerX,
      y: offsetY + line.baselineY,
    })),
  }
}

function buildSvgMarkup(state, layout, fontDataUrl, suffix) {
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
  const textMarkup = layout.lines
    .map((line) => {
      const content = escapeXml(line.text)
      const outlineMarkup =
        state.outlineEnabled && state.outlineWidth > 0
          ? `stroke="${outlinePaint}" stroke-width="${state.outlineWidth}" stroke-linejoin="round" paint-order="stroke fill"`
          : 'stroke="none"'

      return `
        <text
          x="${line.x}"
          y="${line.y}"
          text-anchor="middle"
          font-size="${state.fontSize}"
          letter-spacing="${state.letterSpacing}"
          fill="${fillPaint}"
          ${outlineMarkup}
        >${content}</text>
      `
    })
    .join('')

  const shadowMarkup = state.shadowEnabled
    ? layout.lines
        .map((line) => `
          <text
            x="${line.x + state.shadowOffsetX}"
            y="${line.y + state.shadowOffsetY}"
            text-anchor="middle"
            font-size="${state.fontSize}"
            letter-spacing="${state.letterSpacing}"
            filter="${state.shadowBlur > 0 ? `url(#${shadowFilterId})` : ''}"
            fill="${shadowPaint}"
            stroke="none"
          >${escapeXml(line.text)}</text>
        `)
        .join('')
    : ''

  const backgroundMarkup =
    state.backgroundMode === 'transparent'
      ? ''
      : `<rect width="${layout.width}" height="${layout.height}" fill="${
          state.backgroundMode === 'gradient'
            ? `url(#${backgroundGradientId})`
            : state.backgroundColor1
        }" />`

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
      <defs>${defs.join('')}</defs>
      ${backgroundMarkup}
      ${shadowMarkup}
      ${textMarkup}
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

function SliderInput({ label, value, onChange, min, max, step = 1, formatValue = (next) => next }) {
  function handleChange(nextValue) {
    if (!Number.isNaN(nextValue)) {
      onChange(clamp(nextValue, min, max))
    }
  }

  return (
    <label className="control slider-control">
      <div className="slider-header">
        <span>{label}</span>
        <strong>{formatValue(value)}</strong>
      </div>
      <div className="slider-inputs">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => handleChange(event.target.valueAsNumber)}
        />
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => handleChange(event.target.valueAsNumber)}
        />
      </div>
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
    <div className="grid two-up compact">
      <label className="control">
        <span>{title}</span>
        <select value={mode} onChange={(event) => onModeChange(event.target.value)}>
          {includeTransparent ? <option value="transparent">Transparent</option> : null}
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>
      </label>
      {mode !== 'transparent' ? (
        <>
          <label className="control">
            <span>{mode === 'gradient' ? 'Start' : 'Color'}</span>
            <input type="color" value={color1} onChange={(event) => onColor1Change(event.target.value)} />
          </label>
          {mode === 'gradient' ? (
            <label className="control">
              <span>End</span>
              <input type="color" value={color2} onChange={(event) => onColor2Change(event.target.value)} />
            </label>
          ) : null}
          {mode === 'gradient' ? (
            <div className="full-span">
              <SliderInput
                label="Angle"
                value={angle}
                min={0}
                max={360}
                onChange={onAngleChange}
                formatValue={(next) => `${next}deg`}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function App() {
  const [state, setState] = useState(initialState)
  const [exportScale, setExportScale] = useState(2)
  const [exporting, setExporting] = useState('')
  const [fontDataUrl, setFontDataUrl] = useState('')
  const [activeSection, setActiveSection] = useState('text')
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

  const layout = measureLayout(state)
  const svgMarkup = buildSvgMarkup(state, layout, fontDataUrl, svgId)

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
        downloadFile(svgUrl, `${filenameBase}-${layout.width}x${layout.height}.svg`)
        setTimeout(() => URL.revokeObjectURL(svgUrl), 0)
        return
      }

      const canvas = await svgToCanvas(
        svgMarkup,
        layout.width,
        layout.height,
        exportScale,
        format,
        state.jpgBackground,
      )

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
      const quality = format === 'jpg' ? 0.95 : undefined
      const url = canvas.toDataURL(mimeType, quality)
      downloadFile(url, `${filenameBase}-${layout.width * exportScale}x${layout.height * exportScale}.${format}`)
    } finally {
      setExporting('')
    }
  }

  const sections = [
    { id: 'text', label: 'Text' },
    { id: 'outline', label: 'Outline' },
    { id: 'shadow', label: 'Shadow' },
    { id: 'export', label: 'Export' },
  ]

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>BTTF Text Generator</h1>
      </header>

      <section className="preview-panel">
        <div className="preview-layout">
          <div className="preview-frame">
            <div
              className="preview-surface"
              style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>

          <aside className="preview-sidebar">
            <section className="panel-section metrics-section">
              <h3>Preview</h3>
              <div className="metric-grid">
                <div className="metric-card">
                  <span>Image size</span>
                  <strong>
                    {layout.width} x {layout.height}
                  </strong>
                </div>
                <div className="metric-card">
                  <span>Raster export</span>
                  <strong>
                    {layout.width * exportScale} x {layout.height * exportScale}
                  </strong>
                </div>
              </div>
            </section>

            <section className="panel-section">
              <h3>Background</h3>
              <ColorModeControls
                title="Fill mode"
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
            </section>
          </aside>
        </div>
      </section>

      <section className="editor-panel">
        <div className="section-tabs" role="tablist" aria-label="Editing sections">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`section-tab${activeSection === section.id ? ' is-active' : ''}`}
              onClick={() => setActiveSection(section.id)}
              role="tab"
              aria-selected={activeSection === section.id}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="editor-content">
          {activeSection === 'text' ? (
            <div className="editor-scroll">
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
                  <SliderInput
                    label="Margin"
                    value={state.margin}
                    min={0}
                    max={400}
                    onChange={(value) => patchState('margin', value)}
                    formatValue={(value) => `${value}px`}
                  />
                  <SliderInput
                    label="Font size"
                    value={state.fontSize}
                    min={24}
                    max={600}
                    onChange={(value) => patchState('fontSize', value)}
                    formatValue={(value) => `${value}px`}
                  />
                  <SliderInput
                    label="Line height"
                    value={state.lineHeight}
                    min={0.6}
                    max={2}
                    step={0.05}
                    onChange={(value) => patchState('lineHeight', value)}
                    formatValue={(value) => value.toFixed(2)}
                  />
                  <SliderInput
                    label="Letter spacing"
                    value={state.letterSpacing}
                    min={-10}
                    max={40}
                    step={0.5}
                    onChange={(value) => patchState('letterSpacing', value)}
                    formatValue={(value) => `${value}px`}
                  />
                </div>
                <ColorModeControls
                  title="Text fill"
                  mode={state.fillMode}
                  onModeChange={(value) => patchState('fillMode', value)}
                  color1={state.fillColor1}
                  color2={state.fillColor2}
                  angle={state.fillAngle}
                  onColor1Change={(value) => patchState('fillColor1', value)}
                  onColor2Change={(value) => patchState('fillColor2', value)}
                  onAngleChange={(value) => patchState('fillAngle', value)}
                />
              </section>
            </div>
          ) : null}

          {activeSection === 'outline' ? (
            <div className="editor-scroll">
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
                    <SliderInput
                      label="Stroke width"
                      value={state.outlineWidth}
                      min={0}
                      max={80}
                      onChange={(value) => patchState('outlineWidth', value)}
                      formatValue={(value) => `${value}px`}
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
            </div>
          ) : null}

          {activeSection === 'shadow' ? (
            <div className="editor-scroll">
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
                      <SliderInput
                        label="Offset X"
                        value={state.shadowOffsetX}
                        min={-200}
                        max={200}
                        onChange={(value) => patchState('shadowOffsetX', value)}
                        formatValue={(value) => `${value}px`}
                      />
                      <SliderInput
                        label="Offset Y"
                        value={state.shadowOffsetY}
                        min={-200}
                        max={200}
                        onChange={(value) => patchState('shadowOffsetY', value)}
                        formatValue={(value) => `${value}px`}
                      />
                      <SliderInput
                        label="Blur"
                        value={state.shadowBlur}
                        min={0}
                        max={80}
                        onChange={(value) => patchState('shadowBlur', value)}
                        formatValue={(value) => `${value}px`}
                      />
                      <SliderInput
                        label="Opacity"
                        value={state.shadowOpacity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(value) => patchState('shadowOpacity', value)}
                        formatValue={(value) => value.toFixed(2)}
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
            </div>
          ) : null}

          {activeSection === 'export' ? (
            <div className="editor-scroll">
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
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default App
