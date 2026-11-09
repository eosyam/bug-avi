# 🐞 Bug Avı

AI kodlama araçları işini bitirirken iş arkadaşlarınla oynayabileceğin, tarayıcıda çalışan casual bir arena FPS.

Sunucu odasında NullPointer, RaceCondition, MergeConflict, FlakyTest, MemoryLeak gibi bugları vur; ara sıra çıkan **Prod Incident** boss'unu indir.

## Modlar
- **Sprint (3 dk):** Buglar giderek hızlanır, en yüksek puanı yap.
- **Hayatta Kal:** Sonsuz dalga, her 5. dalgada boss.

## İlerleme
- XP ve level: Stajyer → Junior → … → CTO
- Level ile açılan silahlar: `console.log()`, Hotfix-9, Refactor, Root Cause, `rm -rf`
- Yetenekler: Dash, çift zıplama, `git reset --hard` bombası, Breakpoint (zaman yavaşlatma), Pair Programming drone'u
- ☕ kahve ile kalıcı geliştirmeler, silah renkleri, 10 rozet

## Kontroller
`WASD` hareket · fare nişan · sol tık ateş · `Space` zıpla · `Shift` dash · `R` şarjör · `1-5` / tekerlek silah · `G` / sağ tık bomba · `Q` breakpoint · `Esc` duraklat

## Çalıştırma
Tek dosya: `index.html`. Derleme adımı ya da sunucu gerekmez, doğrudan açabilirsin. GitHub Pages için: **Settings → Pages → Deploy from a branch → `main` / root**.

## Notlar
- Bu sürümde ilerleme tarayıcının `localStorage`'ında tutulur.
- Ortak liderlik tablosu ve Canlı Arena (PvP), Claude üzerinden paylaşılan sürümde çalışır; bu statik sürümde kapalıdır.
- Kaynak: `src/head.html` + `src/game.js`; `build.py` three.js r128'i içine gömerek `index.html`'i üretir.
