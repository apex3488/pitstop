(() => {
    const TOKEN_KEY = "pitstop_admin_token";
    const CONTENT_KEYS = [
        "hero_kicker", "hero_title", "hero_text",
        "about_kicker", "about_title", "about_text",
        "menu_kicker", "menu_title", "menu_text",
        "gallery_kicker", "gallery_title", "gallery_text",
        "moto_kicker", "moto_title", "moto_text",
        "location_kicker", "location_title", "location_text",
        "instagram_kicker", "instagram_title", "instagram_text",
        "footer_tag"
    ];
    const LANGS = ["ru", "uz", "en"];
    const SECTIONS = ["hero", "atmosphere", "auto-moto", "community", "menu-board", "other"];
    const FOLDERS = ["hero", "menu", "atmosphere", "auto-moto", "community", "other"];

    const titles = {
        overview: "Обзор",
        menu: "Меню",
        gallery: "Галерея",
        content: "Тексты",
        location: "Локация",
        settings: "Настройки"
    };

    let data = null;
    let page = "overview";

    const $ = (id) => document.getElementById(id);
    const apiBase = () => (window.PITSTOP_CONFIG && window.PITSTOP_CONFIG.API_BASE_URL || "").replace(/\/$/, "");
    const token = () => sessionStorage.getItem(TOKEN_KEY) || "";
    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const val = (obj, lang) => (obj && typeof obj === "object") ? (obj[lang] || "") : "";
    const publicSrc = (src) => {
        if (!src) return "";
        if (/^https?:/i.test(src)) return src;
        return "../" + String(src).replace(/^\//, "");
    };
    const nextId = (list) => Math.max(0, ...list.map((x) => Number(x.id) || 0)) + 1;

    const flash = (type, message) => {
        const el = $("flash");
        if (!el) return;
        el.hidden = !message;
        el.className = "alert " + type;
        el.textContent = message || "";
    };

    async function api(path, options = {}) {
        const base = apiBase();
        if (!base) throw new Error("Укажите API_BASE_URL в js/config.js");
        const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
        if (token()) headers.Authorization = "Bearer " + token();
        const res = await fetch(base + path, Object.assign({}, options, { headers }));
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
            sessionStorage.removeItem(TOKEN_KEY);
            if (typeof setLoggedIn === "function") setLoggedIn(false);
            throw new Error(body.error || "Сессия истекла. Войдите снова.");
        }
        if (!res.ok) throw new Error(body.error || "Ошибка API");
        return body;
    }

    async function filePayload(file) {
        const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        return { filename: file.name, content };
    }

    async function uploadFile(file, folder) {
        const payload = await filePayload(file);
        return api("/api/upload", {
            method: "POST",
            body: JSON.stringify({
                filename: payload.filename,
                folder,
                content: payload.content
            })
        });
    }

    async function deleteFile(path) {
        if (!path || !String(path).startsWith("images/")) return;
        await api("/api/image", { method: "DELETE", body: JSON.stringify({ path }) });
    }

    async function saveData(message) {
        await api("/api/data", { method: "POST", body: JSON.stringify(data) });
        flash("success", message || "Сохранено в GitHub repository.");
    }

    async function loadSiteData() {
        try {
            data = await api("/api/data");
        } catch (err) {
            const res = await fetch("../data/site-data.json", { cache: "no-cache" });
            if (!res.ok) throw err;
            data = await res.json();
            flash("error", "Worker недоступен для чтения. Показан опубликованный JSON. Сохранение возможно только через API.");
        }
    }

    const setLoggedIn = (on) => {
        document.body.classList.toggle("admin-page", on);
        document.body.classList.toggle("auth-page", !on);
        $("login-form").hidden = on;
        $("admin-app").hidden = !on;
        $("admin-app").setAttribute("aria-hidden", on ? "false" : "true");
        $("login-form").setAttribute("aria-hidden", on ? "true" : "false");
        if (on) $("login-form").style.display = "none";
        else $("login-form").style.display = "";
    };

    const renderNav = () => {
        document.querySelectorAll("[data-nav]").forEach((a) => {
            a.classList.toggle("active", a.getAttribute("data-nav") === page);
        });
        $("page-title").textContent = titles[page] || "Обзор";
    };

    function renderOverview() {
        const cats = (data.menu || []).length;
        const items = (data.menu || []).reduce((n, c) => n + (c.items || []).length, 0);
        const photos = (data.gallery || []).length;
        const locs = (data.locations || []).length;
        const stats = [
            ["Категории меню", cats],
            ["Позиции меню", items],
            ["Фото в галерее", photos],
            ["Платформы локации", locs]
        ];
        $("view").innerHTML = `
            <p class="lede">Все изменения сразу видны на публичном сайте PITSTOP после публикации GitHub Pages.</p>
            <div class="loc-grid" style="margin-top:20px">
                ${stats.map(([label, value]) => `<article class="loc-card"><div class="tiny">${escapeHtml(label)}</div><h3>${value}</h3></article>`).join("")}
            </div>
            <p style="margin-top:24px">
                <a class="btn btn-primary" href="../index.html" target="_blank" rel="noopener">Открыть сайт</a>
            </p>`;
    }

    function renderMenu() {
        const cats = data.menu || [];
        const catOptions = (selected) => cats.map((c) =>
            `<option value="${c.id}" ${String(c.id) === String(selected) ? "selected" : ""}>${escapeHtml(val(c.name, "ru"))}</option>`
        ).join("");
        const catCards = cats.map((c) => `
            <form class="loc-card" data-form="save-cat" data-id="${c.id}" style="margin:12px 0">
                <div class="admin-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
                    <label class="field"><span>RU</span><input name="name_ru" value="${escapeHtml(val(c.name, "ru"))}"></label>
                    <label class="field"><span>UZ</span><input name="name_uz" value="${escapeHtml(val(c.name, "uz"))}"></label>
                    <label class="field"><span>EN</span><input name="name_en" value="${escapeHtml(val(c.name, "en"))}"></label>
                    <label class="field"><span>Порядок</span><input type="number" name="sort" value="${Number(c.sort) || 0}"></label>
                </div>
                <label class="field"><span>Заметка RU</span><input name="note_ru" value="${escapeHtml(val(c.note, "ru"))}"></label>
                <label class="field"><span>Заметка UZ</span><input name="note_uz" value="${escapeHtml(val(c.note, "uz"))}"></label>
                <label class="field"><span>Заметка EN</span><input name="note_en" value="${escapeHtml(val(c.note, "en"))}"></label>
                <label><input type="checkbox" name="visible" ${c.visible !== false ? "checked" : ""}> Показывать</label>
                <div class="admin-actions">
                    <button class="btn btn-primary" type="submit">Сохранить категорию</button>
                    <button class="btn btn-ghost" type="button" data-del-cat="${c.id}">Удалить категорию</button>
                </div>
            </form>`).join("");
        const items = cats.flatMap((c) => (c.items || []).map((it) => Object.assign({ _cat: c.id }, it)));
        const itemCards = items.map((it) => `
            <form class="loc-card" data-form="save-item" data-id="${it.id}" data-cat="${it._cat}" style="margin:12px 0">
                <div class="admin-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
                    <label class="field"><span>Категория</span><select name="category_id">${catOptions(it._cat)}</select></label>
                    <label class="field"><span>Цена</span><input name="price" value="${escapeHtml(it.price || "")}"></label>
                    <label class="field"><span>Порядок</span><input type="number" name="sort" value="${Number(it.sort) || 0}"></label>
                </div>
                <label class="field"><span>Название RU</span><input name="name_ru" value="${escapeHtml(val(it.name, "ru"))}"></label>
                <label class="field"><span>UZ</span><input name="name_uz" value="${escapeHtml(val(it.name, "uz"))}"></label>
                <label class="field"><span>EN</span><input name="name_en" value="${escapeHtml(val(it.name, "en"))}"></label>
                <label class="field"><span>Описание RU</span><input name="description_ru" value="${escapeHtml(val(it.description, "ru"))}"></label>
                <label class="field"><span>UZ</span><input name="description_uz" value="${escapeHtml(val(it.description, "uz"))}"></label>
                <label class="field"><span>EN</span><input name="description_en" value="${escapeHtml(val(it.description, "en"))}"></label>
                ${it.image ? `<img class="thumb" src="${escapeHtml(publicSrc(it.image))}" alt=""><label><input type="checkbox" name="remove_image"> Удалить фото</label>` : ""}
                <label class="field"><span>Фото блюда (необязательно)</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp"></label>
                <label><input type="checkbox" name="visible" ${it.visible !== false ? "checked" : ""}> Показывать</label>
                <div class="admin-actions">
                    <button class="btn btn-primary" type="submit">Сохранить позицию</button>
                    <button class="btn btn-ghost" type="button" data-del-item="${it.id}">Удалить позицию</button>
                </div>
            </form>`).join("");
        $("view").innerHTML = `
            <h2>Категории</h2>
            ${catCards}
            <form class="loc-card" data-form="add-cat" style="margin-top:24px">
                <h3>Новая категория</h3>
                <label class="field"><span>Slug</span><input name="slug" placeholder="desserts"></label>
                <label class="field"><span>Название RU</span><input name="name_ru" required></label>
                <label class="field"><span>UZ</span><input name="name_uz"></label>
                <label class="field"><span>EN</span><input name="name_en"></label>
                <label class="field"><span>Порядок</span><input type="number" name="sort" value="99"></label>
                <button class="btn btn-primary" type="submit">Добавить категорию</button>
            </form>
            <h2 style="margin-top:36px">Позиции</h2>
            ${itemCards}
            ${cats.length ? `<form class="loc-card" data-form="add-item" style="margin-top:24px">
                <h3>Новая позиция</h3>
                <label class="field"><span>Категория</span><select name="category_id">${catOptions(cats[0].id)}</select></label>
                <label class="field"><span>Название RU</span><input name="name_ru" required></label>
                <label class="field"><span>UZ</span><input name="name_uz"></label>
                <label class="field"><span>EN</span><input name="name_en"></label>
                <label class="field"><span>Цена</span><input name="price" placeholder="30 000"></label>
                <button class="btn btn-primary" type="submit">Добавить позицию</button>
            </form>` : ""}`;
    }

    function renderGallery() {
        const photos = (data.gallery || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        const folderFor = (section) => {
            if (section === "menu-board") return "menu";
            if (FOLDERS.includes(section)) return section;
            return "other";
        };
        $("view").innerHTML = `
            <p>Файлы сохраняются в GitHub repository в <code>images/</code>. После обновления страницы они остаются.</p>
            <form class="loc-card" data-form="upload-gallery" style="margin:18px 0">
                <label class="field">
                    <span>Загрузить JPG / PNG / WebP</span>
                    <input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple required>
                </label>
                <label class="field"><span>Категория</span>
                    <select name="section">
                        ${SECTIONS.map((s) => `<option value="${s}">${s}</option>`).join("")}
                    </select>
                </label>
                <button class="btn btn-primary" type="submit">Загрузить</button>
            </form>
            ${photos.map((photo) => `
                <form class="loc-card" data-form="save-photo" data-id="${photo.id}" style="margin:12px 0">
                    ${photo.src ? `<img class="thumb" src="${escapeHtml(publicSrc(photo.src))}" alt="">` : `<p class="tiny">Нет файла</p>`}
                    <label class="field"><span>Заменить файл</span><input type="file" name="replace" accept="image/jpeg,image/png,image/webp"></label>
                    <label class="field"><span>Раздел</span>
                        <select name="section">${SECTIONS.map((s) => `<option value="${s}" ${photo.section === s ? "selected" : ""}>${s}</option>`).join("")}</select>
                    </label>
                    <label class="field"><span>Alt RU</span><input name="alt_ru" value="${escapeHtml(val(photo.alt, "ru"))}"></label>
                    <label class="field"><span>Alt UZ</span><input name="alt_uz" value="${escapeHtml(val(photo.alt, "uz"))}"></label>
                    <label class="field"><span>Alt EN</span><input name="alt_en" value="${escapeHtml(val(photo.alt, "en"))}"></label>
                    <label class="field"><span>Порядок</span><input type="number" name="sort" value="${Number(photo.sort) || 0}"></label>
                    <label><input type="checkbox" name="visible" ${photo.visible !== false ? "checked" : ""}> Показывать</label>
                    <div class="admin-actions">
                        <button class="btn btn-primary" type="submit">Сохранить</button>
                        <button class="btn btn-ghost" type="button" data-del-photo="${photo.id}">Удалить</button>
                    </div>
                </form>`).join("")}`;
        $("view").dataset.folderMap = "1";
        window.__pitstopFolderFor = folderFor;
    }

    function renderContent() {
        const content = data.content || {};
        const settings = data.settings || {};
        const images = [
            ["hero_image", "Hero"],
            ["about_image", "About"],
            ["about_image_2", "About 2"],
            ["moto_image", "Auto & Moto"],
            ["og_image", "Open Graph"]
        ];
        $("view").innerHTML = `
            <form data-form="save-content">
                ${CONTENT_KEYS.map((key) => `
                    <article class="loc-card" style="margin-bottom:14px">
                        <h3>${escapeHtml(key)}</h3>
                        ${LANGS.map((lang) => `
                            <label class="field">
                                <span>${lang.toUpperCase()}</span>
                                <textarea name="${key}_${lang}" rows="3">${escapeHtml(val(content[key], lang))}</textarea>
                            </label>`).join("")}
                    </article>`).join("")}
                <article class="loc-card">
                    <h3>Изображения секций</h3>
                    <p class="tiny">Hero / About / Auto&Moto / Open Graph. Файлы пишутся в images/ через Worker.</p>
                    ${images.map(([field, label]) => `
                        <label class="field">
                            <span>${escapeHtml(label)}</span>
                            ${settings[field] ? `<img class="thumb" src="${escapeHtml(publicSrc(settings[field]))}" alt="">` : ""}
                            <input type="file" name="${field}" accept="image/jpeg,image/png,image/webp">
                        </label>`).join("")}
                </article>
                <button class="btn btn-primary" type="submit" style="margin-top:16px">Сохранить контент</button>
            </form>`;
    }

    function renderLocation() {
        const places = data.locations || [];
        $("view").innerHTML = `
            <p>Если ссылка на отзыв пустая, на сайте используется ссылка на карту/страницу заведения.</p>
            ${places.map((place) => `
                <form class="loc-card" data-form="save-loc" data-id="${place.id}" style="margin:12px 0">
                    <label class="field"><span>Название</span><input name="name" value="${escapeHtml(place.name || "")}"></label>
                    <label class="field"><span>Иконка (yandex, google, 2gis, tripadvisor)</span><input name="icon" value="${escapeHtml(place.icon || "")}"></label>
                    <label class="field"><span>Ссылка</span><input name="map_url" value="${escapeHtml(place.map_url || "")}"></label>
                    <label class="field"><span>Ссылка на отзыв (можно пусто)</span><input name="review_url" value="${escapeHtml(place.review_url || "")}"></label>
                    <label class="field"><span>Кнопка открытия RU / UZ / EN</span>
                        <input name="open_ru" value="${escapeHtml(val(place.open_label, "ru"))}">
                        <input name="open_uz" value="${escapeHtml(val(place.open_label, "uz"))}">
                        <input name="open_en" value="${escapeHtml(val(place.open_label, "en"))}">
                    </label>
                    <label class="field"><span>Кнопка отзыва RU / UZ / EN</span>
                        <input name="rev_ru" value="${escapeHtml(val(place.review_label, "ru"))}">
                        <input name="rev_uz" value="${escapeHtml(val(place.review_label, "uz"))}">
                        <input name="rev_en" value="${escapeHtml(val(place.review_label, "en"))}">
                    </label>
                    <label class="field"><span>Порядок</span><input type="number" name="sort" value="${Number(place.sort) || 0}"></label>
                    <label><input type="checkbox" name="visible" ${place.visible !== false ? "checked" : ""}> Показывать</label>
                    <button class="btn btn-primary" type="submit" style="margin-top:10px">Сохранить</button>
                </form>`).join("")}
            <form class="loc-card" data-form="add-loc" style="margin-top:24px">
                <h3>Новая платформа</h3>
                <label class="field"><span>Slug</span><input name="slug" required></label>
                <label class="field"><span>Название</span><input name="name" required></label>
                <label class="field"><span>Иконка</span><input name="icon" value="default"></label>
                <label class="field"><span>Ссылка</span><input name="map_url"></label>
                <label class="field"><span>Ссылка на отзыв</span><input name="review_url"></label>
                <button class="btn btn-primary" type="submit">Добавить</button>
            </form>`;
    }

    function renderSettings() {
        const s = data.settings || {};
        $("view").innerHTML = `
            <form class="loc-card" data-form="save-settings">
                <label class="field"><span>Title</span><input name="site_title" value="${escapeHtml(s.site_title || "")}"></label>
                <label class="field"><span>Meta description</span><textarea name="site_description" rows="3">${escapeHtml(s.site_description || "")}</textarea></label>
                <label class="field"><span>Instagram URL</span><input name="instagram_url" value="${escapeHtml(s.instagram_url || "")}"></label>
                <label class="field"><span>Instagram handle</span><input name="instagram_handle" value="${escapeHtml(s.instagram_handle || "")}"></label>
                ${LANGS.map((lang) => `
                    <label class="field"><span>Адрес ${lang.toUpperCase()}</span><input name="address_${lang}" value="${escapeHtml(val(s.address, lang))}"></label>
                    <label class="field"><span>Валюта ${lang.toUpperCase()}</span><input name="currency_${lang}" value="${escapeHtml(val(s.currency, lang))}"></label>
                `).join("")}
                <button class="btn btn-primary" type="submit">Сохранить</button>
            </form>
            <form class="loc-card" style="margin-top:20px" onsubmit="return false">
                <h3>Сменить пароль</h3>
                <p class="tiny">Пароль администратора хранится только как Cloudflare Worker secret <code>ADMIN_PASSWORD</code>. Его нельзя сменить из браузера — обновите secret в Cloudflare Dashboard.</p>
            </form>`;
    }

    const screens = { overview: renderOverview, menu: renderMenu, gallery: renderGallery, content: renderContent, location: renderLocation, settings: renderSettings };

    function render() {
        renderNav();
        flash("", "");
        (screens[page] || renderOverview)();
    }

    function findItem(id) {
        for (const cat of data.menu || []) {
            const item = (cat.items || []).find((it) => String(it.id) === String(id));
            if (item) return { cat, item };
        }
        return null;
    }

    async function onSubmit(form) {
        const kind = form.getAttribute("data-form");
        const fd = new FormData(form);
        if (kind === "save-cat") {
            const id = form.getAttribute("data-id");
            const cat = (data.menu || []).find((c) => String(c.id) === String(id));
            if (!cat) return;
            cat.name = { ru: fd.get("name_ru"), uz: fd.get("name_uz"), en: fd.get("name_en") };
            cat.note = { ru: fd.get("note_ru"), uz: fd.get("note_uz"), en: fd.get("note_en") };
            cat.sort = Number(fd.get("sort") || 0);
            cat.visible = form.querySelector('[name="visible"]').checked;
            await saveData("Категория сохранена.");
        }
        if (kind === "add-cat") {
            data.menu = data.menu || [];
            data.menu.push({
                id: nextId(data.menu),
                slug: String(fd.get("slug") || "cat").toLowerCase().replace(/[^a-z0-9\-]+/g, "-").replace(/^-|-$/g, "") || ("cat-" + Date.now()),
                visible: true,
                sort: Number(fd.get("sort") || 99),
                name: { ru: fd.get("name_ru"), uz: fd.get("name_uz"), en: fd.get("name_en") },
                note: { ru: "", uz: "", en: "" },
                items: []
            });
            await saveData("Категория добавлена.");
            render();
        }
        if (kind === "save-item") {
            const found = findItem(form.getAttribute("data-id"));
            if (!found) return;
            const { item } = found;
            const newCatId = fd.get("category_id");
            item.name = { ru: fd.get("name_ru"), uz: fd.get("name_uz"), en: fd.get("name_en") };
            item.description = { ru: fd.get("description_ru"), uz: fd.get("description_uz"), en: fd.get("description_en") };
            item.price = String(fd.get("price") || "");
            item.sort = Number(fd.get("sort") || 0);
            item.visible = form.querySelector('[name="visible"]').checked;
            const file = form.querySelector('[name="image"]').files[0];
            if (file) {
                const up = await uploadFile(file, "menu");
                if (item.image) await deleteFile(item.image);
                item.image = up.path;
            }
            if (form.querySelector('[name="remove_image"]')?.checked && item.image) {
                await deleteFile(item.image);
                item.image = "";
            }
            if (String(found.cat.id) !== String(newCatId)) {
                found.cat.items = found.cat.items.filter((it) => it !== item);
                const dest = data.menu.find((c) => String(c.id) === String(newCatId));
                dest.items = dest.items || [];
                dest.items.push(item);
            }
            await saveData("Позиция сохранена.");
            render();
        }
        if (kind === "add-item") {
            const cat = data.menu.find((c) => String(c.id) === String(fd.get("category_id")));
            const all = data.menu.flatMap((c) => c.items || []);
            cat.items = cat.items || [];
            cat.items.push({
                id: nextId(all),
                visible: true,
                sort: 99,
                name: { ru: fd.get("name_ru"), uz: fd.get("name_uz"), en: fd.get("name_en") },
                description: { ru: "", uz: "", en: "" },
                price: String(fd.get("price") || ""),
                image: ""
            });
            await saveData("Позиция добавлена.");
            render();
        }
        if (kind === "upload-gallery") {
            const files = [...form.querySelector('[name="images"]').files];
            const section = String(fd.get("section") || "atmosphere");
            const folder = window.__pitstopFolderFor ? window.__pitstopFolderFor(section) : "other";
            let ok = 0;
            for (const file of files) {
                const up = await uploadFile(file, folder);
                data.gallery = data.gallery || [];
                const max = Math.max(0, ...data.gallery.map((g) => Number(g.sort) || 0));
                data.gallery.push({
                    id: nextId(data.gallery),
                    src: up.path,
                    section,
                    visible: true,
                    sort: max + 1,
                    alt: { ru: "PITSTOP", uz: "PITSTOP", en: "PITSTOP" }
                });
                ok += 1;
            }
            await saveData("Загружено фото: " + ok + ".");
            render();
        }
        if (kind === "save-photo") {
            const photo = (data.gallery || []).find((g) => String(g.id) === String(form.getAttribute("data-id")));
            if (!photo) return;
            const section = String(fd.get("section") || photo.section);
            const file = form.querySelector('[name="replace"]').files[0];
            if (file) {
                const folder = window.__pitstopFolderFor ? window.__pitstopFolderFor(section) : "other";
                const up = await uploadFile(file, folder);
                if (photo.src) await deleteFile(photo.src);
                photo.src = up.path;
            }
            photo.section = section;
            photo.alt = { ru: fd.get("alt_ru"), uz: fd.get("alt_uz"), en: fd.get("alt_en") };
            photo.sort = Number(fd.get("sort") || 0);
            photo.visible = form.querySelector('[name="visible"]').checked;
            await saveData("Фото обновлено.");
            render();
        }
        if (kind === "save-content") {
            data.content = data.content || {};
            CONTENT_KEYS.forEach((key) => {
                data.content[key] = {};
                LANGS.forEach((lang) => { data.content[key][lang] = String(fd.get(key + "_" + lang) || ""); });
            });
            data.settings = data.settings || {};
            const map = { hero_image: "hero", about_image: "atmosphere", about_image_2: "atmosphere", moto_image: "auto-moto", og_image: "hero" };
            for (const field of Object.keys(map)) {
                const file = form.querySelector(`[name="${field}"]`)?.files[0];
                if (file) {
                    const up = await uploadFile(file, map[field]);
                    data.settings[field] = up.path;
                }
            }
            await saveData("Тексты и изображения секций сохранены.");
            render();
        }
        if (kind === "save-loc") {
            const place = (data.locations || []).find((p) => String(p.id) === String(form.getAttribute("data-id")));
            if (!place) return;
            place.name = String(fd.get("name") || "");
            place.icon = String(fd.get("icon") || "default");
            place.map_url = String(fd.get("map_url") || "");
            place.review_url = String(fd.get("review_url") || "");
            place.open_label = { ru: fd.get("open_ru"), uz: fd.get("open_uz"), en: fd.get("open_en") };
            place.review_label = { ru: fd.get("rev_ru"), uz: fd.get("rev_uz"), en: fd.get("rev_en") };
            place.sort = Number(fd.get("sort") || 0);
            place.visible = form.querySelector('[name="visible"]').checked;
            await saveData("Платформа сохранена.");
        }
        if (kind === "add-loc") {
            data.locations = data.locations || [];
            data.locations.push({
                id: nextId(data.locations),
                slug: String(fd.get("slug") || "map").toLowerCase().replace(/[^a-z0-9\-]+/g, "-"),
                name: String(fd.get("name") || ""),
                icon: String(fd.get("icon") || "default"),
                visible: true,
                sort: 10,
                map_url: String(fd.get("map_url") || ""),
                review_url: String(fd.get("review_url") || ""),
                open_label: { ru: "Открыть", uz: "Ochish", en: "Open" },
                review_label: { ru: "Оставить отзыв", uz: "Fikr qoldirish", en: "Leave a review" }
            });
            await saveData("Платформа добавлена.");
            render();
        }
        if (kind === "save-settings") {
            data.settings = data.settings || {};
            data.settings.site_title = String(fd.get("site_title") || "");
            data.settings.site_description = String(fd.get("site_description") || "");
            data.settings.instagram_url = String(fd.get("instagram_url") || "");
            data.settings.instagram_handle = String(fd.get("instagram_handle") || "");
            data.settings.address = {};
            data.settings.currency = {};
            LANGS.forEach((lang) => {
                data.settings.address[lang] = String(fd.get("address_" + lang) || "");
                data.settings.currency[lang] = String(fd.get("currency_" + lang) || "");
            });
            await saveData("Настройки сохранены.");
        }
    }

    async function bootAdmin() {
        await loadSiteData();
        const hash = (location.hash || "#overview").slice(1);
        page = titles[hash] ? hash : "overview";
        $("who").textContent = "Вы вошли как администратор";
        render();
    }

    $("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = $("login-error");
        err.hidden = true;
        try {
            if (!apiBase()) throw new Error("Сначала укажите URL Worker в js/config.js");
            const password = new FormData(e.target).get("password");
            const result = await fetch(apiBase() + "/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            }).then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error || "Неверный пароль");
                return body;
            });
            sessionStorage.setItem(TOKEN_KEY, result.token);
            setLoggedIn(true);
            document.title = "Обзор — PITSTOP Admin";
            await bootAdmin();
        } catch (ex) {
            err.hidden = false;
            err.textContent = ex.message;
        }
    });

    $("logout-link").addEventListener("click", (e) => {
        e.preventDefault();
        sessionStorage.removeItem(TOKEN_KEY);
        data = null;
        setLoggedIn(false);
        document.title = "Вход — PITSTOP Admin";
        location.hash = "";
    });

    document.querySelectorAll("[data-nav]").forEach((a) => {
        a.addEventListener("click", (e) => {
            e.preventDefault();
            page = a.getAttribute("data-nav");
            location.hash = page;
            render();
        });
    });

    $("view").addEventListener("submit", async (e) => {
        const form = e.target.closest("form");
        if (!form || !form.getAttribute("data-form")) return;
        e.preventDefault();
        try {
            form.querySelector("[type=submit]")?.setAttribute("disabled", "disabled");
            await onSubmit(form);
        } catch (ex) {
            flash("error", ex.message);
        } finally {
            form.querySelector("[type=submit]")?.removeAttribute("disabled");
        }
    });

    $("view").addEventListener("click", async (e) => {
        const delCat = e.target.closest("[data-del-cat]");
        const delItem = e.target.closest("[data-del-item]");
        const delPhoto = e.target.closest("[data-del-photo]");
        try {
            if (delCat) {
                if (!confirm("Удалить категорию и её блюда?")) return;
                const id = delCat.getAttribute("data-del-cat");
                data.menu = (data.menu || []).filter((c) => String(c.id) !== String(id));
                await saveData("Категория удалена.");
                render();
            }
            if (delItem) {
                if (!confirm("Удалить позицию?")) return;
                const id = delItem.getAttribute("data-del-item");
                const found = findItem(id);
                if (found?.item?.image) await deleteFile(found.item.image);
                if (found) found.cat.items = found.cat.items.filter((it) => String(it.id) !== String(id));
                await saveData("Позиция удалена.");
                render();
            }
            if (delPhoto) {
                if (!confirm("Удалить фото с сервера?")) return;
                const id = delPhoto.getAttribute("data-del-photo");
                const photo = (data.gallery || []).find((g) => String(g.id) === String(id));
                if (photo?.src) await deleteFile(photo.src);
                data.gallery = (data.gallery || []).filter((g) => String(g.id) !== String(id));
                await saveData("Фото удалено.");
                render();
            }
        } catch (ex) {
            flash("error", ex.message);
        }
    });

    if (token()) {
        setLoggedIn(true);
        bootAdmin().catch((ex) => {
            sessionStorage.removeItem(TOKEN_KEY);
            setLoggedIn(false);
            $("login-error").hidden = false;
            $("login-error").textContent = ex.message;
        });
    }
})();
