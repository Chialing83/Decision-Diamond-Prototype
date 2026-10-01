/**
 * Cross-page automation rename storage.
 *
 * The static `advancedAutomations` / `automations` arrays in
 * `mockData.ts` never mutate. User renames live in a small
 * `id → newName` map persisted to localStorage and APPLIED at
 * render time on every page that displays an automation's name:
 *
 *   - `Automation.tsx`  (the list / cards)
 *   - `AutomationBuilder.tsx` (the top bar inside the builder)
 *
 * Sharing this module means renaming from EITHER surface updates
 * the other. Storage key is versioned so future shape changes
 * invalidate stale blobs gracefully.
 */

const NAME_OVERRIDES_KEY = 'keap-automation-name-overrides:v1'

export type NameOverrides = Record<string, string>

export function loadNameOverrides(): NameOverrides {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(NAME_OVERRIDES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveNameOverrides(overrides: NameOverrides): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(NAME_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch {
    // ignore quota / private-mode
  }
}

/** Convenience accessor: return the override for an id, or the
 *  supplied fallback (typically the seed name from `mockData`). */
export function getDisplayName(
  overrides: NameOverrides,
  id: string,
  fallback: string,
): string {
  return overrides[id] ?? fallback
}

/** Single-rename helper — produces a new map with one entry
 *  updated, suitable for `setState((prev) => renameInMap(...))`. */
export function renameInMap(
  overrides: NameOverrides,
  id: string,
  next: string,
): NameOverrides {
  return { ...overrides, [id]: next }
}
