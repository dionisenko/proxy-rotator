# proxy-rotator

Автообновляемый пул бесплатных прокси для VykshyParts и других проектов.

- **Источники**: ProxyScrape, Geonode, proxy-list.download.
- **Тестирование**: каждый прокси проверяется `curl` через реальные целевые URL (Autodoc, InterCars, Hart) — проверяется не статус, а тело страницы (отсутствие Cloudflare challenge).
- **Периодичность**: раз в час обнаружение новых прокси, раз в сутки перепроверка всех известных.
- **Публикация**: рабочие прокси коммитятся в `data/proxies.json` этого репозитория.
- **Потребители**: любой сервис может скачать `https://raw.githubusercontent.com/dionisenko/proxy-rotator/main/data/proxies.json`.

## Структура JSON

```json
{
  "updatedAt": "2026-08-08T21:00:00.000Z",
  "proxies": [
    {
      "url": "http://1.2.3.4:8080",
      "lastTested": "2026-08-08T20:55:00.000Z",
      "successes": 4,
      "failures": 1,
      "workingTargets": ["autodoc.pl", "intercars.pl"],
      "averageLatencyMs": 2800
    }
  ]
}
```

## Переменные окружения

| Переменная | Значение по умолчанию | Описание |
|---|---|---|
| `GITHUB_TOKEN` | — | PAT с правами `repo` для коммита `data/proxies.json` |
| `TEST_CONCURRENCY` | 30 | Сколько прокси тестировать параллельно |
| `PROXY_BATCH_LIMIT` | 500 | Максимум кандидатов за один заход |
| `DAILY_RECHECK_AT` | 03:00 | Время ежедневной перепроверки (HH:MM) |

## Локальный запуск

```bash
npm install
GITHUB_TOKEN=ghp_... npm start
```
