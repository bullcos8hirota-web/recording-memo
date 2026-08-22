import type { ReactNode } from 'react'

export type TabId =
  | 'screener'
  | 'symbol'
  | 'positions'
  | 'journal'
  | 'learn'
  | 'settings'

const icon = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-6"
    aria-hidden="true"
  >
    {path}
  </svg>
)

export const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  {
    id: 'screener',
    label: '監視',
    icon: icon(
      <>
        <path d="M4 7h10M4 12h16M4 17h7" />
        <circle cx="18" cy="7" r="2" />
      </>,
    ),
  },
  {
    id: 'symbol',
    label: '銘柄',
    icon: icon(
      <>
        <path d="M4 19V5" />
        <path d="M8 15V9M8 12h0" />
        <rect x="6.5" y="10" width="3" height="6" rx="1" />
        <rect x="12.5" y="6" width="3" height="9" rx="1" />
        <path d="M14 4v2M14 15v3" />
        <path d="M4 19h16" />
      </>,
    ),
  },
  {
    id: 'positions',
    label: '建玉',
    icon: icon(
      <>
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M3 11h18M16 15h2" />
        <path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V7" />
      </>,
    ),
  },
  {
    id: 'journal',
    label: '記録',
    icon: icon(
      <>
        <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
        <path d="M5 16h13M9 8h5" />
      </>,
    ),
  },
  {
    id: 'learn',
    label: '学ぶ',
    icon: icon(
      <>
        <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z" />
        <path d="M20 6.5A1.5 1.5 0 0 0 18.5 5H14a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
      </>,
    ),
  },
  {
    id: 'settings',
    label: '設定',
    icon: icon(
      <>
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
      </>,
    ),
  },
]
