---
name: weeek-setup-changelog
description: Развернуть в проекте пользовательский changelog «Что нового» с нуля — CHANGELOG.mdx + version.json + кнопка-мегафон с поповером в интерфейсе + красная точка непрочитанной версии + страница полной истории + API-роут версии. Используй когда пользователь говорит «заведи changelog в проекте», «добавь Что нового», «сделай систему релизных заметок», «настрой changelog с нуля», «changelog frontend». Это ПЛЕЙБУК разворачивания инфраструктуры (один раз на проект), НЕ обновление записей — записи пополняет скилл weeek-changelog-update.
---

# weeek-setup-changelog

Разворачивает changelog-систему «Что нового»: контент (MDX + version.json), фронт-рендер (кнопка с поповером + красная точка непрочитанной версии), страницу полной истории и API-роут версии.

Это **инфраструктурный плейбук** — запускается один раз на проект. Наполнение и обновление записей делает отдельный скилл `weeek-changelog-update` (собирает из weeek-колонки «Ожидает релиза» + git). Порядок: сначала `weeek-setup-changelog` (создать систему), потом `weeek-changelog-update` (пополнять).

## Что здесь канон

Схема обкатана на трёх проектах, и разошлись они только в косметике:

| | Проект A | Проект B | Проект C |
|---|---|---|---|
| раскладка | `apps/web/` (монорепо) | `apps/web/` (монорепо) | `src/` (одиночный Next) |
| точка входа | иконка в шапке | пункт в футере сайдбара | иконка в шапке |
| UI-алиас | `@workspace/ui/components/*` | `@workspace/ui/components/*` | `@/components/ui/*` |
| `STORAGE_KEY` | `helpDocsLastSeenVersion` | `helpDocsLastSeenVersion` | `appLastSeenVersion` |

**Инвариант во всех трёх** (переносить без изменений): `use-help-version.ts`, `app/api/help/version/route.ts`, формат `version.json`, формат `CHANGELOG.mdx`, маршрут `/help/changelog`, гашение точки по `onOpenChange`.

**Переменное** (подставлять под проект): корень фронта, место кнопки и её вёрстка, алиас UI-кита, `STORAGE_KEY`.

Не изобретай четвёртый вариант. Если в проекте нужна кнопка в другом месте — меняется только вёрстка триггера, логика остаётся.

## Правило точности

- НЕ выдумывать структуру целевого проекта. Сначала **определи стек** (Шаг 1) — пути и способ рендера зависят от него.
- Версии зависимостей НЕ из памяти: прочитай `package.json`/lock целевого проекта и ставь MDX-пакеты **по мажору установленного `next`**.
- Шаблоны кода ниже брать как есть, не переписывать по памяти.

## Параметры проекта (заполнить в начале работы)

Спроси у пользователя или выведи из структуры и зафиксируй:

| Параметр | Пример (монорепо) | Назначение |
|---|---|---|
| `WEB_ROOT` | `apps/web` | корень фронта (`src` или `.` для одиночного Next-приложения) |
| `CONTENT_DIR` | `<WEB_ROOT>/content/help` | где лежат `CHANGELOG.mdx` + `version.json` |
| `IMPORT_ALIAS` | `@/content/help/...` | как импортится контент (проверь `paths` в `tsconfig`) |
| `UI_ALIAS` | `@/components/ui` | откуда берутся `Button` и `Popover` |
| `ENTRY_COMPONENT` | `components/layout/app-header.tsx` | куда встроить кнопку «Что нового» |
| `DASHBOARD_ROUTE_GROUP` | `app/(dashboard)` | где живёт страница `/help/changelog` |
| `STORAGE_KEY` | `helpDocsLastSeenVersion` | localStorage-ключ последней виденной версии |

## Шаг 1. Определить стек и применимость

1. Прочитай `package.json` целевого проекта. Определи: Next.js (App Router? есть `app/`?) / другой React-фреймворк / не-React.
2. Разветвление:
   - **Next.js App Router** → полный путь по шаблонам Шага 2.
   - **Next.js Pages Router / Vite+React / другой** → перенеси ПРИНЦИПЫ (раздел «Архитектура»), но адаптируй механику бандлинга MDX и маршрутов под фреймворк; сообщи пользователю отличия.
   - **Не-React / нет фронта** → останови и сообщи: changelog-фронт разворачивать некуда; можно завести только `CHANGELOG.md` + `version.json` как текстовый источник, а UI отложить.
3. Покажи пользователю определённый стек и заполненные параметры и **подтверди**, прежде чем создавать файлы.

## Архитектура (стек-независимые принципы)

Шесть частей — переноси все, механику адаптируй под стек:

1. **Контент**: `CHANGELOG.mdx` (экспортит `metadata {title, updatedAt}` + секции `## vX.Y.Z — DD месяц YYYY`) и `version.json` (`{current, releasedAt}`). Единственный источник правды.
2. **Бандлинг MDX**: `CHANGELOG.mdx` импортится напрямую как React-компонент, без серверного рендера MDX. В Next — через `@next/mdx` + `pageExtensions`. В других стеках — MDX-плагин соответствующего сборщика.
3. **Точка входа**: кнопка Megaphone → поповер с `<Changelog/>`, шапка с номером версии, ссылка «Полная история →». При открытии зовёт `markAsSeen()`.
4. **Red-dot непрочитанной версии**: хук читает `current` из `/api/help/version` и `localStorage[STORAGE_KEY]`; `hasUnseenVersion = current !== lastSeen`. При открытии поповера пишет `current` в localStorage → точка гаснет. Все обращения к localStorage в try/catch (приватный режим).
5. **Страница полной истории**: маршрут `/help/changelog` рендерит тот же `CHANGELOG.mdx` целиком.
6. **Отдача версии**: `version.json` доступен клиенту — в Next через `GET /api/help/version` с кэш-заголовками; в других стеках статический импорт или эндпоинт.

## Шаг 2. Создать (Next.js App Router)

Шаблоны предполагают Tailwind и UI-кит в духе shadcn/ui — нужны только `Button` и `Popover`. Если кита в проекте нет, замени их на собственные примитивы: логика (хук, маркировка прочитанного, маршруты) от этого не меняется.

Подставляй параметры проекта в пути, алиасы и `STORAGE_KEY`. НЕ тащи контекстную help-панель с секциями (провайдер справки, реестр разделов), даже если она уже есть в проекте, — это отдельная фича, для changelog она не нужна.

### 2.1. Зависимости

Прочитай мажор `next` в `package.json` проекта и возьми `@next/mdx` того же мажора. Пример для проекта на `next 16`:

```
@next/mdx@^16.2.4        # мажор совпадает с next
@mdx-js/react@^3.1.1
@mdx-js/loader@^3.1.1
# dev:
@mdx-js/mdx@^3.1.1
@types/mdx@^2.0.13
```

Ставь пакетным менеджером проекта (смотри lock-файл): `@next/mdx @mdx-js/react @mdx-js/loader` в зависимости, `@mdx-js/mdx @types/mdx` в dev. Точные версии — под мажор `next` в ЭТОМ проекте, не из памяти.

### 2.2. `next.config.mjs`

```js
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // добавить .md/.mdx к расширениям страниц/модулей:
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  // ...существующий конфиг проекта
}

const withMDX = createMDX({}) // без кастомных remark/rehype
export default withMDX(nextConfig)
```

### 2.3. `<WEB_ROOT>/types/mdx.d.ts`

```ts
declare module '*.mdx' {
  import type { ComponentType } from 'react'
  export const metadata: {
    title?: string
    updatedAt?: string
    version?: string
  }
  const Component: ComponentType
  export default Component
}
```

### 2.4. `<WEB_ROOT>/mdx-components.tsx`

Маппинг HTML-элементов MDX на Tailwind-стили. Держи цвета в токенах проекта (`text-foreground`, `text-primary`, …), не хардкодь hex — иначе поповер принесёт чужую палитру.

```tsx
import type { MDXComponents } from 'mdx/types'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (p) => <h1 className="text-2xl font-semibold mb-4" {...p} />,
    h2: (p) => <h2 className="text-lg font-semibold mt-8 mb-2" {...p} />,
    h3: (p) => <h3 className="text-sm font-semibold mt-4 mb-1 text-foreground/80" {...p} />,
    p: (p) => <p className="text-sm leading-relaxed my-2" {...p} />,
    ul: (p) => <ul className="list-disc pl-5 space-y-1 my-2 text-sm" {...p} />,
    ol: (p) => <ol className="list-decimal pl-5 space-y-1 my-2 text-sm" {...p} />,
    li: (p) => <li className="leading-relaxed" {...p} />,
    a: (p) => <a className="text-primary underline underline-offset-2" {...p} />,
    strong: (p) => <strong className="font-semibold" {...p} />,
    code: (p) => <code className="rounded bg-muted px-1 py-0.5 text-xs" {...p} />,
    blockquote: (p) => <blockquote className="border-l-2 pl-3 italic text-foreground/70 my-2" {...p} />,
    hr: (p) => <hr className="my-6 border-border" {...p} />,
    ...components,
  }
}
```

### 2.5. Контент

`<CONTENT_DIR>/version.json`:

```json
{
  "current": "0.1.0",
  "releasedAt": "YYYY-MM-DD"
}
```

`<CONTENT_DIR>/CHANGELOG.mdx` — стартовая запись:

```mdx
export const metadata = {
  title: 'Что нового',
  updatedAt: 'YYYY-MM-DD',
}

# Что нового

## v0.1.0 — DD месяц YYYY

Запущен раздел «Что нового».

- Кнопка открывает список последних изменений
- Красная точка подсвечивает непрочитанную версию
```

Формат заголовка секции: `## vMAJOR.MINOR.PATCH — DD <месяц в родительном падеже> YYYY`, день без ведущего нуля. Новые записи добавляются **сверху**, сразу под `# Что нового` — на это опирается `weeek-changelog-update`.

### 2.6. Хук версии — `<WEB_ROOT>/lib/help/use-help-version.ts`

Инвариант, переносится без изменений (кроме `STORAGE_KEY`):

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'helpDocsLastSeenVersion' // = параметр STORAGE_KEY

type VersionResponse = { current: string; releasedAt: string }

export function useHelpVersion() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/help/version')
      .then((r) => r.json() as Promise<VersionResponse>)
      .then((d) => setCurrentVersion(d.current))
      .catch(() => {}) // тихий фейл — точка просто не покажется

    try {
      setLastSeenVersion(window.localStorage.getItem(STORAGE_KEY))
    } catch {
      /* localStorage недоступен (приватный режим) */
    }
  }, [])

  const markAsSeen = useCallback(() => {
    if (!currentVersion) return
    try {
      window.localStorage.setItem(STORAGE_KEY, currentVersion)
      setLastSeenVersion(currentVersion)
    } catch {
      /* приватный режим — ничего страшного */
    }
  }, [currentVersion])

  const hasUnseenVersion =
    currentVersion !== null && lastSeenVersion !== currentVersion

  return { currentVersion, hasUnseenVersion, markAsSeen }
}
```

### 2.7. API-роут версии — `app/api/help/version/route.ts`

Инвариант, переносится без изменений. MDX здесь не рендерится — только статический JSON, поэтому роут легален в App Router:

```ts
import { NextResponse } from 'next/server'
import version from '@/content/help/version.json'

export async function GET() {
  return NextResponse.json(version, {
    headers: {
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600',
    },
  })
}
```

### 2.8. Кнопка — `<WEB_ROOT>/components/help/whats-new-menu.tsx`

Базовый вариант, иконка в шапке:

```tsx
'use client'

import { Megaphone } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Changelog from '@/content/help/CHANGELOG.mdx'
import { useHelpVersion } from '@/lib/help/use-help-version'

export function WhatsNewMenu() {
  const { currentVersion, hasUnseenVersion, markAsSeen } = useHelpVersion()

  // Открытие поповера = версия прочитана, точка гаснет.
  const handleOpenChange = (open: boolean) => {
    if (open) markAsSeen()
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Что нового"
          className="relative h-8 w-8 sm:h-9 sm:w-9"
        >
          <Megaphone className="h-4 w-4 sm:h-5 sm:w-5" />
          {hasUnseenVersion && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[380px] p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Что нового</span>
          {currentVersion && (
            <span className="text-xs text-muted-foreground">v{currentVersion}</span>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto px-4 py-3">
          <Changelog />
        </div>
        <div className="border-t px-4 py-2 text-right">
          <Link href="/help/changelog" className="text-xs text-primary underline underline-offset-2">
            Полная история →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

**Вариант «пункт в сайдбаре»** (как в проекте B), если в проекте нет шапки с иконками. Меняется только триггер, всё остальное — как выше:

- компонент принимает проп `collapsed?: boolean`;
- `Button` вместо `size="icon"` получает вёрстку строки меню: `h-auto p-2 w-full`, слева иконка `h-5 w-5 shrink-0`, справа подпись «Что нового», скрытая при `collapsed`;
- красная точка в развёрнутом виде идёт обычным элементом строки, в свёрнутом — `absolute right-1.5 top-1.5`;
- у `PopoverContent` добавь `side="right"`.

### 2.9. Страница полной истории — `<DASHBOARD_ROUTE_GROUP>/help/changelog/page.tsx`

```tsx
import type { Metadata } from 'next'
import Changelog from '@/content/help/CHANGELOG.mdx'

export const metadata: Metadata = { title: 'Справка — Что нового' }

export default function HelpChangelogPage() {
  return (
    <main className="mx-auto max-w-3xl px-8 py-6">
      <Changelog />
    </main>
  )
}
```

Прямой `import` — не заводи промежуточный загрузчик контента, он ничего не добавляет.

### 2.10. Встраивание

В `<ENTRY_COMPONENT>`, рядом с прочими иконками правой части:

```tsx
import { WhatsNewMenu } from '@/components/help/whats-new-menu'
// ...
<WhatsNewMenu />
```

## Шаг 3. Проверка

1. Проверка типов — команду возьми из `scripts` в `package.json` проекта, не выдумывай её (может быть `type-check`, `typecheck` или просто `tsc --noEmit`). Импорт `*.mdx` должен типизироваться через `types/mdx.d.ts`, а `version.json` — резолвиться (в `tsconfig` включён `resolveJsonModule`).
2. Сборка проекта — тоже командой из `scripts`. Убедись, что `.mdx` попал в `pageExtensions` и страница `/help/changelog` собирается.
3. Ручной чек в UI: кнопка Megaphone на месте, поповер открывается, красная точка появляется на новой версии и гаснет после открытия, «Полная история →» ведёт на страницу.
4. Сообщи пользователю: коммит он делает сам; дальше пополнять changelog — скиллом `weeek-changelog-update`.

## Частые грабли

- **`Cannot find module '*.mdx'`** → нет `types/mdx.d.ts` или файл не попал в `include` в `tsconfig`.
- **MDX не бандлится** → забыт `pageExtensions` с `mdx` ЛИБО `next.config` не обёрнут в `withMDX`.
- **`version.json` не импортируется** → в `tsconfig` нет `"resolveJsonModule": true`.
- **Чужие цвета в поповере** → в `mdx-components.tsx` использованы hex или произвольные классы вместо токенов проекта.
- **Мажор `@next/mdx` ≠ мажор `next`** → сборка падает; ставь по мажору установленного `next`.
- **Точка не гаснет** → `markAsSeen()` не вызван из `onOpenChange`, либо `STORAGE_KEY` в хуке разошёлся с тем, что реально пишется.

## Стоп-условия

- Стек без React-фронта → не разворачивать UI, предложить только текстовый `CHANGELOG.md` + `version.json`.
- Changelog-система в проекте уже есть (`CHANGELOG.mdx` + `version.json` + рендер) → не пересоздавать; сообщить и предложить `weeek-changelog-update`.
