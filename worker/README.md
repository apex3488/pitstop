# PITSTOP Cloudflare Worker

Безопасный API между админкой и GitHub REST API.

```text
PITSTOP GitHub Pages
        ↓
Cloudflare Worker API
        ↓
GitHub API
        ↓
GitHub Repository (images + data/site-data.json)
```

Полная инструкция: корневой [README.md](../README.md).

## 1. Cloudflare account

1. Откройте https://dash.cloudflare.com/sign-up
2. Создайте бесплатный аккаунт
3. Подтвердите email

## 2. Создать Worker

1. Dashboard → **Workers & Pages**
2. **Create** → **Worker**
3. Имя: `pitstop-api` (или любое)
4. Deploy заготовки, затем замените код на `src/index.js`

## 3. Установить / задеплоить

### Dashboard

Вставьте `src/index.js` в редактор Worker и нажмите **Deploy**.

### Wrangler (Node нужен только здесь)

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Перед деплоем заполните `[vars]` в `wrangler.toml`:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`

## 4–5. Secrets

Worker → **Settings → Variables and Secrets**:

| Name | Secret? |
| --- | --- |
| `GITHUB_TOKEN` | да |
| `ADMIN_PASSWORD` | да |
| `GITHUB_OWNER` | нет |
| `GITHUB_REPO` | нет |
| `GITHUB_BRANCH` | нет (`main`) |

Через Wrangler:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_PASSWORD
```

Не печатайте значения в терминал через `echo`.

## 6. GitHub token

Fine-grained token:

- только репозиторий PITSTOP
- **Contents: Read and write**
- без admin, без доступа к другим репозиториям

Classic token (если используете): минимум `repo` для private repository или содержимое для public.

## 7. URL Worker в frontend

Скопируйте `https://<name>.<subdomain>.workers.dev` в `js/config.js` → `API_BASE_URL`.

## 8. Проверить API

```text
GET /api/data
POST /api/login   { "password": "..." }
POST /api/upload  (после login, Authorization: Bearer ...)
DELETE /api/image
POST /api/data
```

Без токена `GET /api/data` должен отдать JSON. Остальные методы — только с сессией админки.

## 9. GitHub Pages

См. корневой README: Settings → Pages → main / root.

## 10. Проверить загрузку фото

1. Войдите в `/admin/`
2. Галерея → выбрать файл → Загрузить
3. В GitHub repository должен появиться файл `images/...`
4. `data/site-data.json` должен обновиться
5. Refresh админки и публичного сайта — фото остаётся

## Endpoints

- `GET /api/data` — актуальные данные из GitHub
- `POST /api/login` — проверка `ADMIN_PASSWORD`, выдача session token
- `POST /api/upload` — JPG/PNG/WebP, до 8 MB, безопасное имя
- `DELETE /api/image` — удаление файла в `images/`
- `POST|PUT /api/data` — запись `data/site-data.json` (нужен SHA существующего файла)

Запрещены для upload: php, js, html, exe, bat, sh, svg и прочие не-изображения. MIME проверяется по сигнатуре файла, не только по расширению.
