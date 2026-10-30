import { useEffect, useRef, useState } from 'react'

function useCountUp(target: number, active: boolean) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1100)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active])
  return v
}

export default function Counters({ items }: { items: { value: number; suffix?: string; label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setSeen(true)), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div className="counters" ref={ref}>
      {items.map((it) => (
        <CounterCell key={it.label} {...it} active={seen} />
      ))}
    </div>
  )
}

function CounterCell({ value, suffix, label, active }: { value: number; suffix?: string; label: string; active: boolean }) {
  const v = useCountUp(value, active)
  return (
    <div className="counter">
      <div className="counter-n">{v}{suffix}</div>
      <div className="counter-l">{label}</div>
    </div>
  )
}
