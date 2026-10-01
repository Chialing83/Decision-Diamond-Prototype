import { create } from 'zustand'
import { deals as initialDeals, Deal } from '../data/mockData'

interface User {
  name: string
  firstInitial: string
  email: string
}

interface AppState {
  selectedContactId: string | null
  selectedDealId: string | null
  activeNavSection: string | null
  deals: Deal[]

  // Primary-nav reactive state
  user: User
  unreadCommsCount: number
  notificationCount: number

  setSelectedContact: (id: string | null) => void
  setSelectedDeal: (id: string | null) => void
  setActiveNavSection: (section: string | null) => void
  setUnreadCommsCount: (n: number) => void
  setNotificationCount: (n: number) => void
  moveDeal: (dealId: string, toColumn: string) => void
  toggleTask: (taskId: string) => void
  doneTasks: Set<string>
}

export const useStore = create<AppState>((set) => ({
  selectedContactId: null,
  selectedDealId: null,
  activeNavSection: null,
  deals: initialDeals,
  doneTasks: new Set(),

  // Primary-nav defaults
  user: { name: 'Whiskers', firstInitial: 'W', email: 'whiskers@catnip.example' },
  unreadCommsCount: 1,
  notificationCount: 4,

  setSelectedContact: (id) => set({ selectedContactId: id }),
  setSelectedDeal: (id) => set({ selectedDealId: id }),
  setActiveNavSection: (section) => set({ activeNavSection: section }),
  setUnreadCommsCount: (n) => set({ unreadCommsCount: n }),
  setNotificationCount: (n) => set({ notificationCount: n }),
  moveDeal: (dealId, toColumn) =>
    set((state) => ({
      deals: state.deals.map((d) =>
        d.id === dealId ? { ...d, column: toColumn } : d
      ),
    })),
  toggleTask: (taskId) =>
    set((state) => {
      const next = new Set(state.doneTasks)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return { doneTasks: next }
    }),
}))
