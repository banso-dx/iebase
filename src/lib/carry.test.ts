import { describe, expect, it } from "vitest"
import { isCarryKind } from "./carry"

describe("isCarryKind", () => {
  it("財布・バッグ・ポーチは持ち物", () => {
    expect(isCarryKind("wallet")).toBe(true)
    expect(isCarryKind("bag")).toBe(true)
    expect(isCarryKind("pouch")).toBe(true)
  })
  it("家具は持ち物ではない", () => {
    expect(isCarryKind("closet")).toBe(false)
  })
})
