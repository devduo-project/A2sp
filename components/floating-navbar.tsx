"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { cn } from "@/lib/utils"

export interface FloatingNavbarItem {
  label: string
  value: string
  href?: string
  icon?: ReactNode
}

export interface FloatingNavbarProps {
  items: FloatingNavbarItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  containerRef?: RefObject<HTMLElement | null>
  hideOnScroll?: boolean
  shrinkOnScroll?: boolean
  className?: string
  "aria-label"?: string
}

export function FloatingNavbar({ items, value, defaultValue, onValueChange, containerRef, hideOnScroll = true, shrinkOnScroll = true, className, "aria-label": ariaLabel = "Основная навигация CRM" }: FloatingNavbarProps) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.value ?? "")
  const activeValue = isControlled ? value : internalValue
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  const select = (next: string) => { if (!isControlled) setInternalValue(next); onValueChange?.(next) }

  const measure = useCallback(() => {
    const el = itemRefs.current.get(activeValue)
    if (!el) return
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
  }, [activeValue])

  useLayoutEffect(measure, [measure])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    itemRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [measure, items])

  useEffect(() => {
    const container = containerRef?.current ?? null
    let lastY = 0
    const onScroll = (event: Event) => {
      const target = event.target
      const isDocument = target === document
      if (!isDocument && target !== container) return
      const y = isDocument ? window.scrollY : (target as HTMLElement).scrollTop
      if (shrinkOnScroll) setScrolled(y > 24)
      if (hideOnScroll) {
        const delta = y - lastY
        if (y > 96 && delta > 4) setHidden(true)
        else if (delta < -4 || y <= 96) setHidden(false)
      }
      lastY = y
    }
    window.addEventListener("scroll", onScroll, { passive: true, capture: true })
    return () => window.removeEventListener("scroll", onScroll, { capture: true })
  }, [containerRef, hideOnScroll, shrinkOnScroll])

  return (
    <nav aria-label={ariaLabel} className={cn("floating-navbar", scrolled && "is-scrolled", hidden && "is-hidden", className)}>
      <ul ref={listRef} className="floating-navbar-list">
        <span aria-hidden="true" className={cn("floating-navbar-indicator", indicator.ready && "is-ready")} style={{ left: indicator.left, width: indicator.width }} />
        {items.map((item) => {
          const isActive = item.value === activeValue
          return (
            <li key={item.value}>
              <a
                ref={(el) => { if (el) itemRefs.current.set(item.value, el); else itemRefs.current.delete(item.value) }}
                href={item.href ?? `#${item.value}`}
                aria-current={isActive ? "page" : undefined}
                className={cn("floating-navbar-link", isActive && "is-active")}
                onClick={(event) => { event.preventDefault(); select(item.value) }}
                onKeyDown={(event) => { if (event.key === " ") { event.preventDefault(); select(item.value) } }}
              >
                {item.icon}
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
