import { useEffect, useId, useRef, useState } from 'react'
import './App.css'

const defaultText = 'INTO THE <\n> future'
const FONT_FAMILY = '"BTTF Generator", sans-serif'
const MAX_EXTRA_GRADIENT_STOPS = 3

function createBaseGradientStops(prefix, startColor, endColor) {
  return [
    { id: `${prefix}-start`, kind: 'start', position: 0, color: startColor },
    { id: `${prefix}-end`, kind: 'end', position: 100, color: endColor },
  ]
}

const initialState = {
  text: defaultText,
  margin: 20,
  fontSize: 150,
  lineHeight: 1.1,
  letterSpacing: 4,
  backgroundMode: 'gradient',
  backgroundGradientStops: createBaseGradientStops('background', '#132949', '#2c476d'),
  backgroundAngle: 65,
  fillMode: 'gradient',
  fillGradientStops: createBaseGradientStops('fill', '#C31104', '#FEE137'),
  fillAngle: 90,
  outlineEnabled: true,
  outlineWidth: 8,
  outlineMode: 'gradient',
  outlineGradientStops: [
    { id: 'outline-start', kind: 'start', position: 0, color: '#ffffff' },
    { id: 'outline-extra-1', kind: 'extra', position: 20, color: '#ffffff' },
    { id: 'outline-extra-2', kind: 'extra', position: 40, color: '#000000' },
    { id: 'outline-extra-3', kind: 'extra', position: 60, color: '#ffffff' },
    { id: 'outline-end', kind: 'end', position: 100, color: '#ffffff' },
  ],
  outlineAngle: 90,
  shadowEnabled: true,
  shadowBlur: 6,
  shadowOffsetX: 6,
  shadowOffsetY: 6,
  shadowOffsetsLinked: false,
  shadowLinkRatio: 1,
  shadowOpacity: 0.7,
  shadowMode: 'solid',
  shadowGradientStops: createBaseGradientStops('shadow', '#000000', '#7a0000'),
  shadowAngle: 90,
  extrusionEnabled: true,
  extrusionOffsetX: 6,
  extrusionOffsetY: 6,
  extrusionOffsetsLinked: false,
  extrusionLinkRatio: 1,
  extrusionLayers: 32,
  extrusionTextureMode: 'shadow',
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

function sortGradientStops(stops) {
  return [...stops].sort((a, b) => a.position - b.position)
}

function getBaseColor(stops) {
  return stops[0]?.color || '#ffffff'
}

function buildGradient(id, angle, stops, opacity = 1) {
  const vector = gradientVector(angle)
  const sortedStops = sortGradientStops(stops)
  const stopMarkup = sortedStops
    .map((stop) => {
      const stopColor = opacity === 1 ? stop.color : colorWithOpacity(stop.color, opacity)
      return `<stop offset="${clamp(stop.position, 0, 100)}%" stop-color="${stopColor}" />`
    })
    .join('')

  return `
    <linearGradient id="${id}" x1="${vector.x1}" y1="${vector.y1}" x2="${vector.x2}" y2="${vector.y2}">
      ${stopMarkup}
    </linearGradient>
  `
}

function getPaint(mode, id, color) {
  return mode === 'gradient' ? `url(#${id})` : color
}

function getExtrusionLayerCount(offsetX, offsetY) {
  return clamp(Math.ceil(Math.max(Math.abs(offsetX), Math.abs(offsetY))), 1, 180)
}

function getAxisRatio(x, y) {
  if (Math.abs(x) < 0.0001) {
    return null
  }

  return y / x
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

  const shadowSourceOffsetX = state.extrusionEnabled ? state.extrusionOffsetX : 0
  const shadowSourceOffsetY = state.extrusionEnabled ? state.extrusionOffsetY : 0
  const blurPadding = state.shadowEnabled ? state.shadowBlur * 3 : 0
  const shadowBounds = state.shadowEnabled
    ? {
        minX: contentBounds.minX + shadowSourceOffsetX + state.shadowOffsetX - blurPadding,
        maxX: contentBounds.maxX + shadowSourceOffsetX + state.shadowOffsetX + blurPadding,
        minY: contentBounds.minY + shadowSourceOffsetY + state.shadowOffsetY - blurPadding,
        maxY: contentBounds.maxY + shadowSourceOffsetY + state.shadowOffsetY + blurPadding,
      }
    : textBounds

  const extrusionBounds = state.extrusionEnabled
    ? {
        minX: Math.min(contentBounds.minX, contentBounds.minX + state.extrusionOffsetX),
        maxX: Math.max(contentBounds.maxX, contentBounds.maxX + state.extrusionOffsetX),
        minY: Math.min(contentBounds.minY, contentBounds.minY + state.extrusionOffsetY),
        maxY: Math.max(contentBounds.maxY, contentBounds.maxY + state.extrusionOffsetY),
      }
    : textBounds

  const renderBounds = {
    minX: Math.min(textBounds.minX, shadowBounds.minX, extrusionBounds.minX),
    maxX: Math.max(textBounds.maxX, shadowBounds.maxX, extrusionBounds.maxX),
    minY: Math.min(textBounds.minY, shadowBounds.minY, extrusionBounds.minY),
    maxY: Math.max(textBounds.maxY, shadowBounds.maxY, extrusionBounds.maxY),
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
    defs.push(buildGradient(backgroundGradientId, state.backgroundAngle, state.backgroundGradientStops))
  }

  if (state.fillMode === 'gradient') {
    defs.push(buildGradient(fillGradientId, state.fillAngle, state.fillGradientStops))
  }

  if (state.outlineEnabled && state.outlineMode === 'gradient') {
    defs.push(buildGradient(outlineGradientId, state.outlineAngle, state.outlineGradientStops))
  }

  if (state.shadowEnabled && state.shadowMode === 'gradient') {
    defs.push(
      buildGradient(
        shadowGradientId,
        state.shadowAngle,
        state.shadowGradientStops,
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
    colorWithOpacity(getBaseColor(state.shadowGradientStops), state.shadowOpacity),
  )
  const fillPaint = getPaint(state.fillMode, fillGradientId, getBaseColor(state.fillGradientStops))
  const outlinePaint = getPaint(state.outlineMode, outlineGradientId, getBaseColor(state.outlineGradientStops))
  const borderFallbackPaint =
    state.outlineEnabled && state.outlineWidth > 0
      ? outlinePaint
      : fillPaint
  const extrusionPaint =
    state.extrusionTextureMode === 'shadow'
      ? shadowPaint
      : borderFallbackPaint
  const shadowSourceOffsetX = state.extrusionEnabled ? state.extrusionOffsetX : 0
  const shadowSourceOffsetY = state.extrusionEnabled ? state.extrusionOffsetY : 0
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
            x="${line.x + shadowSourceOffsetX + state.shadowOffsetX}"
            y="${line.y + shadowSourceOffsetY + state.shadowOffsetY}"
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

  const extrusionLayerCount = clamp(
    Math.round(state.extrusionLayers || getExtrusionLayerCount(state.extrusionOffsetX, state.extrusionOffsetY)),
    1,
    360,
  )
  const extrusionOutlineMarkup =
    state.outlineEnabled && state.outlineWidth > 0
      ? `stroke="${extrusionPaint}" stroke-width="${state.outlineWidth}" stroke-linejoin="round" paint-order="stroke fill"`
      : 'stroke="none"'
  const extrusionMarkup = state.extrusionEnabled
    ? Array.from({ length: extrusionLayerCount }, (_, index) => index + 1)
        .map((layer) => {
          const progress = layer / extrusionLayerCount
          const xOffset = state.extrusionOffsetX * progress
          const yOffset = state.extrusionOffsetY * progress

          return layout.lines
            .map(
              (line) => `
                <text
                  x="${line.x + xOffset}"
                  y="${line.y + yOffset}"
                  text-anchor="middle"
                  font-size="${state.fontSize}"
                  letter-spacing="${state.letterSpacing}"
                  fill="${extrusionPaint}"
                  ${extrusionOutlineMarkup}
                >${escapeXml(line.text)}</text>
              `,
            )
            .join('')
        })
        .join('')
    : ''

  const backgroundMarkup =
    state.backgroundMode === 'transparent'
      ? ''
      : `<rect width="${layout.width}" height="${layout.height}" fill="${
          state.backgroundMode === 'gradient'
            ? `url(#${backgroundGradientId})`
            : getBaseColor(state.backgroundGradientStops)
        }" />`

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
      <defs>${defs.join('')}</defs>
      ${backgroundMarkup}
      ${shadowMarkup}
      ${extrusionMarkup}
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

function GradientStopsEditor({ angle, stops, selectedStopId, onSelectedStopChange, onStopsChange }) {
  const barRef = useRef(null)
  const localCounterRef = useRef(0)

  const sortedStops = sortGradientStops(stops)
  const selectedStop = stops.find((stop) => stop.id === selectedStopId) || stops[0]
  const extraStops = stops.filter((stop) => stop.kind === 'extra')
  const canAddStop = extraStops.length < MAX_EXTRA_GRADIENT_STOPS

  const previewBackground = `linear-gradient(${angle}deg, ${sortedStops
    .map((stop) => `${stop.color} ${clamp(stop.position, 0, 100)}%`)
    .join(', ')})`

  function updateStopPosition(stopId, position) {
    onStopsChange(
      stops.map((stop) =>
        stop.id === stopId && stop.kind === 'extra'
          ? { ...stop, position: clamp(position, 0, 100) }
          : stop,
      ),
    )
  }

  function getPositionFromClientX(clientX) {
    if (!barRef.current) {
      return 0
    }

    const rect = barRef.current.getBoundingClientRect()
    const relative = (clientX - rect.left) / rect.width
    return clamp(relative * 100, 0, 100)
  }

  function addStop() {
    if (!canAddStop) {
      return
    }

    localCounterRef.current += 1
    const newStop = {
      id: `extra-${localCounterRef.current}`,
      kind: 'extra',
      position: 50,
      color: selectedStop?.color || stops[0]?.color || '#ffffff',
    }

    onStopsChange([...stops, newStop])
    onSelectedStopChange(newStop.id)
  }

  function removeSelectedStop() {
    if (!selectedStop || selectedStop.kind !== 'extra') {
      return
    }

    const nextStops = stops.filter((stop) => stop.id !== selectedStop.id)
    onStopsChange(nextStops)
    onSelectedStopChange(nextStops[0]?.id || '')
  }

  function beginDrag(event, stop) {
    onSelectedStopChange(stop.id)

    if (stop.kind !== 'extra') {
      return
    }

    const handlePointerMove = (moveEvent) => {
      updateStopPosition(stop.id, getPositionFromClientX(moveEvent.clientX))
    }
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    updateStopPosition(stop.id, getPositionFromClientX(event.clientX))
  }

  return (
    <div className="gradient-editor">
      <div className="gradient-stop-actions">
        <button type="button" onClick={addStop} disabled={!canAddStop}>
          Add point
        </button>
        <button type="button" onClick={removeSelectedStop} disabled={!selectedStop || selectedStop.kind !== 'extra'}>
          Remove point
        </button>
      </div>

      <div className="gradient-track-shell">
        <div className="gradient-track" ref={barRef} style={{ background: previewBackground }}>
          {sortedStops.map((stop) => (
            <button
              key={stop.id}
              type="button"
              className={`gradient-stop-handle${selectedStop?.id === stop.id ? ' is-selected' : ''}${
                stop.kind !== 'extra' ? ' is-fixed' : ''
              }`}
              style={{ left: `${clamp(stop.position, 0, 100)}%`, '--stop-color': stop.color }}
              onPointerDown={(event) => beginDrag(event, stop)}
              aria-label={`${stop.kind} point`}
              title={stop.kind === 'extra' ? 'Drag to move point' : stop.kind}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColorModeControls({
  title,
  mode,
  onModeChange,
  gradientStops,
  angle,
  onGradientStopsChange,
  onAngleChange,
  includeTransparent = false,
}) {
  const [selectedGradientStopId, setSelectedGradientStopId] = useState(gradientStops[0]?.id || '')
  const baseColor = getBaseColor(gradientStops)
  const selectedGradientStop = gradientStops.find((stop) => stop.id === selectedGradientStopId) || gradientStops[0]

  useEffect(() => {
    if (!selectedGradientStop && gradientStops[0]) {
      setSelectedGradientStopId(gradientStops[0].id)
    }
  }, [selectedGradientStop, gradientStops])

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
            <span>{mode === 'gradient' ? 'Selected point color' : 'Color'}</span>
            <input
              type="color"
              value={mode === 'gradient' ? selectedGradientStop?.color || baseColor : baseColor}
              onChange={(event) =>
                onGradientStopsChange(
                  gradientStops.map((stop, index) => {
                    if (mode === 'gradient') {
                      return stop.id === selectedGradientStop?.id ? { ...stop, color: event.target.value } : stop
                    }

                    return index === 0 ? { ...stop, color: event.target.value } : stop
                  }),
                )
              }
            />
          </label>
          {mode === 'gradient' ? (
            <div className="full-span gradient-controls-block">
              <GradientStopsEditor
                angle={angle}
                stops={gradientStops}
                selectedStopId={selectedGradientStopId}
                onSelectedStopChange={setSelectedGradientStopId}
                onStopsChange={onGradientStopsChange}
              />
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

  function toggleShadowOffsetLink(checked) {
    setState((current) => ({
      ...current,
      shadowOffsetsLinked: checked,
      shadowLinkRatio: checked ? getAxisRatio(current.shadowOffsetX, current.shadowOffsetY) : current.shadowLinkRatio,
    }))
  }

  function toggleExtrusionOffsetLink(checked) {
    setState((current) => ({
      ...current,
      extrusionOffsetsLinked: checked,
      extrusionLinkRatio: checked
        ? getAxisRatio(current.extrusionOffsetX, current.extrusionOffsetY)
        : current.extrusionLinkRatio,
    }))
  }

  function setLinkedShadowOffset(axis, nextValue) {
    setState((current) => {
      if (!current.shadowOffsetsLinked) {
        return { ...current, [axis]: nextValue }
      }

      const ratio = current.shadowLinkRatio

      if (axis === 'shadowOffsetX') {
        if (ratio !== null && Number.isFinite(ratio)) {
          return {
            ...current,
            shadowOffsetX: nextValue,
            shadowOffsetY: clamp(nextValue * ratio, -200, 200),
          }
        }

        const delta = nextValue - current.shadowOffsetX
        return {
          ...current,
          shadowOffsetX: nextValue,
          shadowOffsetY: clamp(current.shadowOffsetY + delta, -200, 200),
        }
      }

      if (ratio !== null && Number.isFinite(ratio) && Math.abs(ratio) > 0.0001) {
        return {
          ...current,
          shadowOffsetY: nextValue,
          shadowOffsetX: clamp(nextValue / ratio, -200, 200),
        }
      }

      const delta = nextValue - current.shadowOffsetY
      return {
        ...current,
        shadowOffsetY: nextValue,
        shadowOffsetX: clamp(current.shadowOffsetX + delta, -200, 200),
      }
    })
  }

  function setLinkedExtrusionOffset(axis, nextValue) {
    setState((current) => {
      if (!current.extrusionOffsetsLinked) {
        return { ...current, [axis]: nextValue }
      }

      const ratio = current.extrusionLinkRatio

      if (axis === 'extrusionOffsetX') {
        if (ratio !== null && Number.isFinite(ratio)) {
          return {
            ...current,
            extrusionOffsetX: nextValue,
            extrusionOffsetY: clamp(nextValue * ratio, -220, 220),
          }
        }

        const delta = nextValue - current.extrusionOffsetX
        return {
          ...current,
          extrusionOffsetX: nextValue,
          extrusionOffsetY: clamp(current.extrusionOffsetY + delta, -220, 220),
        }
      }

      if (ratio !== null && Number.isFinite(ratio) && Math.abs(ratio) > 0.0001) {
        return {
          ...current,
          extrusionOffsetY: nextValue,
          extrusionOffsetX: clamp(nextValue / ratio, -220, 220),
        }
      }

      const delta = nextValue - current.extrusionOffsetY
      return {
        ...current,
        extrusionOffsetY: nextValue,
        extrusionOffsetX: clamp(current.extrusionOffsetX + delta, -220, 220),
      }
    })
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
  const linkIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.6 13.4a4 4 0 0 1 0-5.66l2.12-2.12a4 4 0 0 1 5.66 5.66l-1.77 1.77m-3.21-2.55a4 4 0 0 1 0 5.66l-2.12 2.12a4 4 0 0 1-5.66-5.66l1.77-1.77"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Back to the Future Text Generator</h1>
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
                gradientStops={state.backgroundGradientStops}
                angle={state.backgroundAngle}
                onGradientStopsChange={(value) => patchState('backgroundGradientStops', value)}
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
                  gradientStops={state.fillGradientStops}
                  angle={state.fillAngle}
                  onGradientStopsChange={(value) => patchState('fillGradientStops', value)}
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
                      gradientStops={state.outlineGradientStops}
                      angle={state.outlineAngle}
                      onGradientStopsChange={(value) => patchState('outlineGradientStops', value)}
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
                    <h4>Soft shadow</h4>
                    <div className="grid two-up">
                      <SliderInput
                        label="Offset X"
                        value={state.shadowOffsetX}
                        min={-200}
                        max={200}
                        onChange={(value) => setLinkedShadowOffset('shadowOffsetX', value)}
                        formatValue={(value) => `${value}px`}
                      />
                      <SliderInput
                        label="Offset Y"
                        value={state.shadowOffsetY}
                        min={-200}
                        max={200}
                        onChange={(value) => setLinkedShadowOffset('shadowOffsetY', value)}
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
                    <div className="offset-link-row">
                      <button
                        type="button"
                        className={`link-icon-button${state.shadowOffsetsLinked ? ' is-linked' : ''}`}
                        onClick={() => toggleShadowOffsetLink(!state.shadowOffsetsLinked)}
                        aria-label="Toggle shadow offset link"
                        title={state.shadowOffsetsLinked ? 'Offsets linked' : 'Link offsets'}
                      >
                        {linkIcon}
                      </button>
                    </div>
                    <ColorModeControls
                      title="Shadow color"
                      mode={state.shadowMode}
                      onModeChange={(value) => patchState('shadowMode', value)}
                      gradientStops={state.shadowGradientStops}
                      angle={state.shadowAngle}
                      onGradientStopsChange={(value) => patchState('shadowGradientStops', value)}
                        onAngleChange={(value) => patchState('shadowAngle', value)}
                      />
                  </>
                ) : null}
                <div className="section-title-row sub-section-title">
                  <h4>3D extrusion</h4>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={state.extrusionEnabled}
                      onChange={(event) => patchState('extrusionEnabled', event.target.checked)}
                    />
                    <span>Enable</span>
                  </label>
                </div>
                {state.extrusionEnabled ? (
                  <>
                    <div className="grid two-up">
                      <SliderInput
                        label="Depth X"
                        value={state.extrusionOffsetX}
                        min={-220}
                        max={220}
                        onChange={(value) => setLinkedExtrusionOffset('extrusionOffsetX', value)}
                        formatValue={(value) => `${value}px`}
                      />
                      <SliderInput
                        label="Depth Y"
                        value={state.extrusionOffsetY}
                        min={-220}
                        max={220}
                        onChange={(value) => setLinkedExtrusionOffset('extrusionOffsetY', value)}
                        formatValue={(value) => `${value}px`}
                      />
                    </div>
                    <div className="offset-link-row">
                      <button
                        type="button"
                        className={`link-icon-button${state.extrusionOffsetsLinked ? ' is-linked' : ''}`}
                        onClick={() => toggleExtrusionOffsetLink(!state.extrusionOffsetsLinked)}
                        aria-label="Toggle extrusion depth link"
                        title={state.extrusionOffsetsLinked ? 'Depth linked' : 'Link depth'}
                      >
                        {linkIcon}
                      </button>
                    </div>
                    <SliderInput
                      label="Edge precision"
                      value={state.extrusionLayers}
                      min={1}
                      max={360}
                      onChange={(value) => patchState('extrusionLayers', value)}
                      formatValue={(value) => `${value} layers`}
                    />
                    <label className="control">
                      <span>Edge texture</span>
                      <select
                        value={state.extrusionTextureMode}
                        onChange={(event) => patchState('extrusionTextureMode', event.target.value)}
                      >
                        <option value="border">Border color (fallback text)</option>
                        <option value="shadow">Shadow color</option>
                      </select>
                    </label>
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
