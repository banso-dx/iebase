import { describe, expect, it } from "vitest"
import { daysUntil, formatDate, formatYen } from "./labels"

describe("formatYen / formatDate", () => {
  it("値がなければダッシュ", () => {
    expect(formatYen(null)).toBe("—")
    expect(formatDate(undefined)).toBe("—")
  })
  it("円表記にする", () => {
    expect(formatYen(1500)).toMatch(/1,500/)
  })
})

describe("daysUntil", () => {
  const offset = (days: number) => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }
  it("今日は 0、明日は 1、昨日は -1", () => {
    expect(daysUntil(offset(0))).toBe(0)
    expect(daysUntil(offset(1))).toBe(1)
    expect(daysUntil(offset(-1))).toBe(-1)
  })
})
