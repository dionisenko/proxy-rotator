# Proxy Rotator Architecture

Автообновляемый пул бесплатных прокси для краулеров VykshyParts и других проектов.

## Архитектура

```text
┌──────────────────────────────────────────────────────────────┐
│  GitHub: dionisenko/proxy-rotator                            │
│  ├── data/proxies.json        ← публичный список рабочих      │
│  ├── src/index.mjs            ← updater-сервис               │
│  └── Dockerfile / docker-compose.yml                          │
└──────────────────────────┬───────────────────────────────────┘
                           │ обновляет / коммитит
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Dokploy-сервер: контейнер proxy-rotator                     │
│  • раз в час скачивает списки бесплатных прокси              │
│  • тестирует их curl'ом через реальные целевые URL           │
│  • раз в сутки перепроверяет уже известные                   │
│  • пушит рабочие в data/proxies.json                          │
└──────────────────────────┬───────────────────────────────────┘
                           │ raw.githubusercontent.com
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  VykshyParts backend                                         │
│  • lib/proxy-pool.js   — скачивает JSON, хранит в MongoDB    │
│  • rebrowser-cf.js     — берёт прокси из пула                │
│  • hart-rebrowser-session.js — берёт прокси из пула          │
│  • /api/admin/proxy-pool — ручное обновление / статистика    │
└──────────────────────────────────────────────────────────────┘
```

## Репозиторий

- `https://github.com/dionisenko/proxy-rotator`
- Публичный список: `https://raw.githubusercontent.com/dionisenko/proxy-rotator/main/data/proxies.json`

## Что тестируется

Каждый кандидат проверяется через `curl -x <proxy>` на трёх целях:

| Цель | URL | Проверка |
|---|---|---|
| Autodoc | `https://www.autodoc.pl/valeo/c1416` | тело содержит `Valeo`/`Sklep`, нет `Cloudflare`/`Attention Required` |
| InterCars | `https://intercars.pl` | тело содержит `Inter Cars`/`Katalog`, нет Cloudflare |
| Hart | `https://store.hartphp.com.pl/Account/Login` | тело содержит `Logowanie`/`Hart`, нет Cloudflare |

Прокси считается рабочим для цели, если тело ответа прошло все проверки.

## Развёртывание на Dokploy-сервере

```bash
ssh root@161.97.115.228
cd /opt/proxy-rotator
# .env должен содержать GITHUB_TOKEN
docker compose -p proxy-rotator up -d --build
```

При обновлении:

```bash
cd /opt/proxy-rotator
git pull origin main
docker compose -p proxy-rotator up -d --build
```

## Переменные окружения (updater)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `GITHUB_TOKEN` | — | PAT с правами `repo` |
| `TEST_CONCURRENCY` | 30 | Параллельность тестирования |
| `TEST_TIMEOUT_SEC` | 15 | Таймаут одного теста |
| `PROXY_BATCH_LIMIT` | 500 | Максимум кандидатов за проход |
| `DAILY_RECHECK_AT` | 03:00 | Время ежедневной перепроверки |

## Интеграция в VykshyParts

`lib/proxy-pool.js` кэширует список в MongoDB (`proxy_pool`) и обновляется лениво каждые 15 мин.

API:

```js
import { getProxyForTarget, withProxyPool, refreshProxyPool } from './lib/proxy-pool.js';

// Вернуть один прокси для цели
const proxy = await getProxyForTarget('autodoc');

// Выполнить массовую работу через пул
const results = await withProxyPool({
  target: 'autodoc',
  items: skus,
  concurrency: 10,
  task: ({ item, proxy }) => fetchProduct(item, proxy),
});

// Принудительно обновить список
await refreshProxyPool(true);
```

Поддерживаемые цели:

- `autodoc` / `autodoc.pl`
- `intercars` / `intercars.pl`
- `hart` / `hartphp.com.pl`

## Ручное управление

Админ API VykshyParts:

- `GET /api/admin/proxy-pool` — статистика пула
- `POST /api/admin/proxy-pool` — принудительно обновить список

## Отключение пула

Если нужно временно не использовать пул:

```bash
REBROWSER_USE_PROXY_POOL=0
```

При этом rebrowser и Hart rebrowser будут использовать только `REBROWSER_PROXY_SERVER` или системную настройку `autodoc_working_proxy_url`.
