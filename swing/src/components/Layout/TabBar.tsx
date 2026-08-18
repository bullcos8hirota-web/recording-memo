import { TABS, type TabId } from './tabs'

/**
 * スマホでは画面下、タブレット以上では画面上にナビゲーションを出す。
 * 下タブは親指が届く位置に置き、セーフエリア分の余白を確保する。
 */
export function BottomTabBar({
  tab,
  onChange,
  badges,
}: {
  tab: TabId
  onChange: (tab: TabId) => void
  badges?: Partial<Record<TabId, number>>
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:hidden">
      <ul className="flex">
        {TABS.map((item) => {
          const active = tab === item.id
          const badge = badges?.[item.id] ?? 0
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 transition ${
                  active
                    ? 'text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                <span className="relative">
                  {item.icon}
                  {badge > 0 && (
                    <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function TopTabBar({
  tab,
  onChange,
  badges,
}: {
  tab: TabId
  onChange: (tab: TabId) => void
  badges?: Partial<Record<TabId, number>>
}) {
  return (
    <nav className="-mb-px mt-2 hidden gap-1 sm:flex">
      {TABS.map((item) => {
        const badge = badges?.[item.id] ?? 0
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === item.id
                ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            {item.label}
            {badge > 0 && (
              <span className="ml-1 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-neutral-700">
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
