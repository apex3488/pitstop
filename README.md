# PITSTOP

Сайт **PITSTOP** — auto&moto community café в Ташкенте.

Бренд всегда пишется **PITSTOP** (одним словом).

## Как это устроено

```text
GitHub Pages = frontend (статический сайт)
Cloudflare Worker = безопасный API
GitHub repository = постоянное хранилище (фото, видео, data/site-data.json)
```

Публичный сайт не использует PHP, SQLite и Node.js.

GitHub token и пароль админки **никогда** не попадают в HTML/JS. Они хранятся только как Secrets Cloudflare Worker.

Если Worker временно недоступен, публичный сайт продолжает показывать последнюю опубликованную копию `data/site-data.json`.

## 1. GitHub repository

1. Создайте репозиторий и загрузите этот проект в ветку `main`.
2. Не коммитьте `.env`, `worker/.dev.vars` и любые файлы с токенами.

## 2. GitHub Pages

В репозитории:

```text
Settings → Pages → Build and deployment
```

Вариант A (проще):

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

Вариант B: GitHub Actions workflow `.github/workflows/pages.yml`.

Сайт будет примерно:

```text
https://USERNAME.github.io/REPOSITORY/
```

Все пути относительные, поэтому проектный URL GitHub Pages работает.

После публикации подождите 1–2 минуты.

## 3. Cloudflare Worker

Worker лежит в папке `worker/`.

1. Зарегистрируйтесь на [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Откройте **Workers & Pages → Create**.
3. Создайте Worker (имя, например `pitstop-api`).
4. Вставьте код из `worker/src/index.js` или задеплойте через Wrangler:

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Node.js нужен **только** чтобы задеплоить Worker. Сайт на GitHub Pages от Node.js не зависит.

Подробности: `worker/README.md`.

## 4. GitHub Token

Создайте fine-grained personal access token:

1. GitHub → Settings → Developer settings → Personal access tokens.
2. Repository access: **только** репозиторий PITSTOP.
3. Permissions: **Contents: Read and write**.
4. Скопируйте token один раз и сохраните в Cloudflare. Не вставляйте его в код сайта.

## 5. Worker Secrets

В Cloudflare: Worker → Settings → Variables and Secrets.

| Имя | Тип | Назначение |
| --- | --- | --- |
| `GITHUB_TOKEN` | Secret | доступ к GitHub Contents API |
| `ADMIN_PASSWORD` | Secret | пароль входа в админку |
| `GITHUB_OWNER` | Text | ваш GitHub username или org |
| `GITHUB_REPO` | Text | имя репозитория |
| `GITHUB_BRANCH` | Text | обычно `main` |

Пример без секретов: `.env.example`.

В `worker/wrangler.toml` замените `YOUR_GITHUB_USERNAME` и `YOUR_REPO_NAME` на свои значения (это не секреты).

## 6. Deploy Worker

После secrets нажмите **Deploy**.

Скопируйте URL Worker, например:

```text
https://pitstop-api.YOUR_SUBDOMAIN.workers.dev
```

## 7. API URL

Откройте `js/config.js` и укажите URL Worker **без** завершающего слэша:

```javascript
window.PITSTOP_CONFIG = {
  API_BASE_URL: "https://pitstop-api.YOUR_SUBDOMAIN.workers.dev"
};
```

Это единственное место, куда нужно вписать API URL.

Проверка:

```text
GET https://pitstop-api.YOUR_SUBDOMAIN.workers.dev/api/data
```

Должен вернуться JSON сайта.

## 8. Admin login

Админка: `admin/` (на GitHub Pages: `https://USERNAME.github.io/REPOSITORY/admin/`).

Пароль — значение secret `ADMIN_PASSWORD`.

Логин в форме нужен только визуально; сервер проверяет пароль Worker.

После входа браузер хранит **сессию** (token сессии), не GitHub token и не пароль.

## 9. Upload photos

В админке: **Галерея**.

1. Выберите JPG / PNG / WebP.
2. Выберите категорию (`atmosphere`, `hero`, `menu-board`, `auto-moto`, `other`).
3. Нажмите **Загрузить**.
4. Worker записывает файл в `images/...` через GitHub API и обновляет `data/site-data.json`.

Можно заменить, скрыть, изменить порядок и удалить фото. То же для фото блюд и секций Hero / About / Auto & Moto.

## 10. Updating the site

После сохранения GitHub обновляет файлы в repository. GitHub Pages пересобирает сайт. Через короткое время новая фотография видна на публичной странице.

Проверка постоянства:

```text
Login → Upload → Save → Refresh → фото на месте
Logout → Login → фото на месте
Открыть публичный сайт → фото на месте
```

Данные не хранятся только в localStorage.

## Локальный просмотр frontend

Сайт статический. Из корня проекта:

```bash
python -m http.server 8080
```

Откройте http://localhost:8080/

Без Worker админка не сможет сохранять в GitHub, но публичный сайт читает `data/site-data.json`.

## Что нельзя делать

- Класть `GITHUB_TOKEN` в JS/HTML/CSS
- Коммитить `.env` с реальными значениями
- Загружать php / js / html / svg / exe как «фото»
- Менять бренд на `PIT STOP`

## Структура

```text
index.html
404.html
js/config.js
assets/css/
assets/js/site.js
images/hero|menu|atmosphere|auto-moto|community|other/
videos/
data/site-data.json
admin/
worker/
```
