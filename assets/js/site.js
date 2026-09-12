(() => {
    const ICONS = {
        yandex: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2zm1.2 5H9.1v10h2.1v-3.5h1.7c2.3 0 3.7-1.3 3.7-3.3S15.4 7 13.2 7zm-.1 5h-1.7V8.8h1.6c1.2 0 1.9.6 1.9 1.6s-.7 1.6-1.8 1.6z"/></svg>',
        google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.2a8.8 8.8 0 1 0 0 17.6c2.4 0 4.4-.8 5.9-2.1l-2.4-1.9c-.8.5-1.9.9-3.5.9A5.3 5.3 0 0 1 6.8 12 5.3 5.3 0 0 1 12 6.7c1.4 0 2.4.6 3 .1.1l2.1-2.1C15.6 3.8 13.9 3.2 12 3.2z"/><path fill="currentColor" d="M21.6 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h5.4a4.6 4.6 0 0 1-2 3l2.4 1.9c1.4-1.3 2.8-3.4 2.8-6.5z"/></svg>',
        "2gis": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>',
        tripadvisor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.2 8.4a3.4 3.4 0 1 0 .1 6.8 3.4 3.4 0 0 0-.1-6.8zm7.6 0a3.4 3.4 0 1 0 .1 6.8 3.4 3.4 0 0 0-.1-6.8zM12 6.2 9.6 3H3.8L7 6.4A8 8 0 0 0 4.4 12a7.6 7.6 0 0 0 15.2 0 8 8 0 0 0-2.6-5.6L20.2 3h-5.8L12 6.2z"/></svg>',
        default: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M12 7v5l3 2"/></svg>'
    };

    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const withBreaks = (value) => escapeHtml(String(value ?? "").replace(/\\n/g, "\n")).replace(/\n/g, "<br>");

    const pick = (obj, lang) => {
        if (!obj) return "";
        if (typeof obj === "string") return obj;
        return obj[lang] || obj.ru || obj.en || "";
    };

    const asset = (src) => {
        if (!src) return "";
        if (/^https?:/i.test(src)) return src;
        return src.replace(/^\//, "");
    };

    const currentLang = () => {
        const params = new URLSearchParams(location.search);
        const fromUrl = params.get("lang");
        if (["ru", "uz", "en"].includes(fromUrl)) {
            localStorage.setItem("pitstop_lang", fromUrl);
            return fromUrl;
        }
        const stored = localStorage.getItem("pitstop_lang");
        if (["ru", "uz", "en"].includes(stored)) return stored;
        return "ru";
    };

    async function loadData() {
        const api = (window.PITSTOP_CONFIG && window.PITSTOP_CONFIG.API_BASE_URL || "").replace(/\/$/, "");
        if (api) {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 4000);
                const res = await fetch(api + "/api/data", { signal: ctrl.signal });
                clearTimeout(t);
                if (res.ok) return await res.json();
            } catch (err) {
                console.warn("API fallback to published JSON", err);
            }
        }
        const res = await fetch("data/site-data.json", { cache: "no-cache" });
        if (!res.ok) throw new Error("Cannot load site data");
        return res.json();
    }

    const bindUi = () => {
        const headerBurger = document.querySelector("[data-burger]");
        const mobileNav = document.querySelector("[data-mobile-nav]");
        const catButtons = [...document.querySelectorAll("[data-cat]")];
        const panels = [...document.querySelectorAll("[data-panel]")];
        const lightbox = document.querySelector("[data-lightbox]");
        const lightboxImg = lightbox?.querySelector("img");
        const sources = [...document.querySelectorAll("[data-gallery]")];
        let index = 0;

        const closeNav = () => {
            mobileNav?.classList.remove("open");
            document.body.classList.remove("nav-open");
            headerBurger?.setAttribute("aria-expanded", "false");
            mobileNav?.setAttribute("aria-hidden", "true");
        };

        headerBurger?.addEventListener("click", () => {
            const open = !mobileNav.classList.contains("open");
            mobileNav.classList.toggle("open", open);
            document.body.classList.toggle("nav-open", open);
            headerBurger.setAttribute("aria-expanded", String(open));
            mobileNav.setAttribute("aria-hidden", String(!open));
        });

        mobileNav?.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeNav);
        });

        catButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const id = button.getAttribute("data-cat");
                catButtons.forEach((b) => b.classList.toggle("active", b === button));
                panels.forEach((p) => p.classList.toggle("active", p.getAttribute("data-panel") === id));
            });
        });

        const catsEl = document.querySelector("[data-cats]");
        const prevCat = document.querySelector("[data-cats-prev]");
        const nextCat = document.querySelector("[data-cats-next]");
        const updateCatArrows = () => {
            if (!catsEl) return;
            const max = Math.max(0, catsEl.scrollWidth - catsEl.clientWidth);
            const atStart = catsEl.scrollLeft <= 2;
            const atEnd = catsEl.scrollLeft >= max - 2;
            prevCat?.classList.toggle("is-disabled", atStart);
            nextCat?.classList.toggle("is-disabled", atEnd);
            if (prevCat) prevCat.disabled = atStart;
            if (nextCat) nextCat.disabled = atEnd;
        };
        const scrollCats = (dir) => {
            if (!catsEl) return;
            catsEl.scrollBy({ left: dir * Math.max(180, catsEl.clientWidth * 0.55), behavior: "smooth" });
        };
        prevCat?.addEventListener("click", () => scrollCats(-1));
        nextCat?.addEventListener("click", () => scrollCats(1));
        catsEl?.addEventListener("scroll", updateCatArrows, { passive: true });
        window.addEventListener("resize", updateCatArrows);
        updateCatArrows();

        const communityVideos = [...document.querySelectorAll("[data-about-video]")];
        const tryPlay = (video) => video.play().catch(() => {});
        communityVideos.forEach((video) => {
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            tryPlay(video);
            video.addEventListener("click", () => {
                if (video.paused) tryPlay(video);
                else video.pause();
            });
        });
        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) tryPlay(entry.target);
                    else entry.target.pause();
                });
            }, { threshold: 0.3 });
            communityVideos.forEach((video) => io.observe(video));
        }

        const openLightbox = (i) => {
            if (!lightbox || !lightboxImg || !sources[i]) return;
            index = i;
            lightboxImg.src = sources[i].getAttribute("data-src");
            lightboxImg.alt = sources[i].getAttribute("data-alt") || "";
            lightbox.classList.add("open");
            document.body.style.overflow = "hidden";
        };

        const closeLightbox = () => {
            lightbox?.classList.remove("open");
            document.body.style.overflow = "";
            if (lightboxImg) lightboxImg.src = "";
        };

        sources.forEach((el, i) => {
            el.addEventListener("click", () => openLightbox(i));
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLightbox(i);
                }
            });
        });

        lightbox?.querySelector("[data-close]")?.addEventListener("click", closeLightbox);
        lightbox?.querySelector("[data-prev]")?.addEventListener("click", () => {
            openLightbox((index - 1 + sources.length) % sources.length);
        });
        lightbox?.querySelector("[data-next]")?.addEventListener("click", () => {
            openLightbox((index + 1) % sources.length);
        });
        document.addEventListener("keydown", (e) => {
            if (!lightbox?.classList.contains("open")) return;
            if (e.key === "Escape") closeLightbox();
            if (e.key === "ArrowLeft") openLightbox((index - 1 + sources.length) % sources.length);
            if (e.key === "ArrowRight") openLightbox((index + 1) % sources.length);
        });
        lightbox?.addEventListener("click", (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    };

    const render = (data, lang) => {
        const ui = data.ui[lang] || data.ui.ru;
        const content = data.content || {};
        const settings = data.settings || {};
        document.documentElement.lang = lang;
        document.title = settings.site_title || "PITSTOP — Auto & Moto Community Café";
        const desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute("content", settings.site_description || "");

        document.querySelectorAll("[data-ui]").forEach((el) => {
            el.textContent = ui[el.getAttribute("data-ui")] || el.textContent;
        });
        document.querySelectorAll("[data-content]").forEach((el) => {
            el.textContent = pick(content[el.getAttribute("data-content")], lang);
        });
        document.querySelectorAll("[data-content-html]").forEach((el) => {
            const key = el.getAttribute("data-content-html");
            const value = pick(content[key], lang);
            if (key === "moto_title" && value.startsWith("PITSTOP")) {
                el.innerHTML = `<span class="moto-wordmark">PITSTOP</span>${withBreaks(value.slice(7))}`;
            } else {
                el.innerHTML = withBreaks(value);
            }
        });

        document.querySelectorAll("[data-lang]").forEach((a) => {
            a.classList.toggle("active", a.getAttribute("data-lang") === lang);
            a.setAttribute("href", "?lang=" + a.getAttribute("data-lang"));
        });

        const nav = [
            ["#home", ui.nav_home],
            ["#about", ui.nav_about],
            ["#menu", ui.nav_menu],
            ["#atmosphere", ui.nav_atmosphere],
            ["#moto", ui.nav_moto],
            ["#location", ui.nav_location]
        ];
        const desk = document.querySelector("[data-desktop-nav]");
        if (desk) desk.innerHTML = nav.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join("");
        const mobile = document.querySelector("[data-mobile-nav]");
        if (mobile) {
            mobile.innerHTML = nav.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join("") +
                `<a href="${escapeHtml(settings.instagram_url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.nav_instagram)}</a>`;
        }

        const hero = document.querySelector("[data-hero-img]");
        if (hero) hero.src = asset(settings.hero_image);
        const videos = settings.community_videos || [];
        document.querySelectorAll("[data-about-video]").forEach((video) => {
            const index = Number(video.getAttribute("data-about-video") || 0);
            const src = asset(videos[index]);
            if (!src) return;
            const source = video.querySelector("source");
            if (source) source.src = src;
            video.src = src;
            video.load();
        });
        const moto = document.querySelector("[data-moto-img]");
        if (moto) moto.src = asset(settings.moto_image);

        const currency = pick(settings.currency, lang);
        const catsEl = document.querySelector("[data-cats]");
        const panelsEl = document.querySelector("[data-menu-panels]");
        const visibleCats = (data.menu || []).filter((c) => c.visible !== false).sort((a, b) => a.sort - b.sort);
        if (catsEl && panelsEl) {
            catsEl.innerHTML = visibleCats.map((c, i) =>
                `<button type="button" data-cat="${c.id}" class="${i === 0 ? "active" : ""}">${escapeHtml(pick(c.name, lang))}</button>`
            ).join("");
            panelsEl.innerHTML = visibleCats.map((c, i) => {
                const items = (c.items || []).filter((it) => it.visible !== false);
                const note = pick(c.note, lang);
                return `<div class="menu-panel ${i === 0 ? "active" : ""}" data-panel="${c.id}">
                    ${note ? `<p class="menu-note">${escapeHtml(note)}</p>` : ""}
                    <div class="menu-list">
                        ${items.map((it) => `<article class="menu-row"><div>
                            ${it.image ? `<img class="dish-thumb" src="${escapeHtml(asset(it.image))}" alt="${escapeHtml(pick(it.name, lang))}" loading="lazy">` : ""}
                            <h3>${escapeHtml(pick(it.name, lang))}</h3>
                            ${pick(it.description, lang) ? `<p>${escapeHtml(pick(it.description, lang))}</p>` : ""}
                        </div>${it.price ? `<div class="price">${escapeHtml(it.price)} <span class="tiny">${escapeHtml(currency)}</span></div>` : ""}</article>`).join("")}
                    </div>
                </div>`;
            }).join("");
        }

        const boards = (data.gallery || []).filter((g) => g.visible !== false && g.section === "menu-board");
        const boardsEl = document.querySelector("[data-menu-boards]");
        if (boardsEl) {
            boardsEl.innerHTML = boards.map((g) =>
                `<button type="button" data-gallery data-src="${escapeHtml(asset(g.src))}" data-alt="${escapeHtml(pick(g.alt, lang))}">${escapeHtml(ui.paper_menu)}</button>`
            ).join("");
        }

        const atm = (data.gallery || []).filter((g) => g.visible !== false && g.section === "atmosphere").sort((a, b) => a.sort - b.sort);
        const gal = document.querySelector("[data-gallery-scroll]");
        if (gal) {
            gal.innerHTML = atm.map((g) =>
                `<button class="gallery-card" type="button" data-gallery data-src="${escapeHtml(asset(g.src))}" data-alt="${escapeHtml(pick(g.alt, lang))}" aria-label="${escapeHtml(ui.gallery_open)}">
                    <img src="${escapeHtml(asset(g.src))}" alt="${escapeHtml(pick(g.alt, lang))}" loading="lazy">
                </button>`
            ).join("");
        }

        const addr = document.querySelector("[data-address]");
        if (addr) addr.textContent = pick(settings.address, lang);

        const locEl = document.querySelector("[data-locations]");
        const locations = (data.locations || []).filter((l) => l.visible !== false).sort((a, b) => a.sort - b.sort);
        if (locEl) {
            locEl.innerHTML = locations.map((place) => {
                const openUrl = place.map_url || "";
                const reviewUrl = (place.review_url || "").trim() || openUrl;
                const icon = ICONS[place.icon] || ICONS.default;
                return `<article class="loc-card">
                    <h3>${icon} ${escapeHtml(place.name)}</h3>
                    <div class="loc-actions">
                        ${openUrl ? `<a class="main" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pick(place.open_label, lang))}</a>` : ""}
                        ${reviewUrl ? `<a href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pick(place.review_label, lang))}</a>` : ""}
                    </div>
                </article>`;
            }).join("");
        }

        const igH = document.querySelector("[data-ig-handle]");
        if (igH) igH.textContent = settings.instagram_handle || "@pitstop_avtomotocafe";
        const igL = document.querySelector("[data-ig-link]");
        if (igL) igL.href = settings.instagram_url || "https://www.instagram.com/pitstop_avtomotocafe/";
    };

    loadData()
        .then((data) => {
            render(data, currentLang());
            bindUi();
        })
        .catch((err) => {
            console.error(err);
            bindUi();
        });
})();
