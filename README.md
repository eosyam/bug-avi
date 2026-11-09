# 🐞 Bug Hunt / Bug Avı

*English (default) and Turkish UI — switch with the EN/TR toggle.*

AI kodlama araçları işini bitirirken iş arkadaşlarınla oynayabileceğin, tarayıcıda çalışan casual bir arena FPS.

Sunucu odasında NullPointer, RaceCondition, MergeConflict, FlakyTest, MemoryLeak gibi bugları vur; ara sıra çıkan **Prod Incident** boss'unu indir.

## Modlar
- **Sprint (3 dk):** Buglar giderek hızlanır, en yüksek puanı yap.
- **Hayatta Kal:** Sonsuz dalga, her 5. dalgada boss.
- **Canlı Arena:** Arkadaşlarınla gerçek zamanlı herkes-herkese karşı PvP; 5 dakikalık maçlar, MVP ekranı, seri duyuruları, doğuş koruması.

## İlerleme
- XP ve level: Stajyer → Junior → … → CTO
- Level ile açılan silahlar: `console.log()`, Hotfix-9, Refactor, Ricochet (seken lazer), Root Cause, `rm -rf`
- Yetenekler: Dash, çift zıplama, kanca, `git reset --hard` bombası, kalkan, Breakpoint, ışınlanma, Pair Programming drone'u
- Düşmanlar arasında bakınca görünmez olan Heisenbug, birlikte öldürülmesi gereken Deadlock ikizleri ve duvarlardan geçen Glitch da var
- ☕ kahve ile kalıcı geliştirmeler, silah renkleri, 10 rozet

## Kontroller
`WASD` hareket · fare nişan · sol tık ateş · `Space` zıpla · `Shift` dash · `E` kanca · `F` kalkan · `V` ışınlanma · `R` şarjör · `1-6` / tekerlek silah · `G` / sağ tık bomba · `Q` breakpoint · `Tab` arena skor tablosu · `Esc` duraklat

## Canlı Arena ve ortak liderlik tablosu
Çok oyunculu kısım `server/` klasöründeki küçük bir Cloudflare Worker ile çalışır (Durable Objects: arena/lobi için WebSocket odaları, liderlik tablosu için SQLite). Sunucu yoksa oyun tek oyunculu modda açılır.

## Yayına alma (tek seferlik kurulum)
1. **Cloudflare API token:** Cloudflare → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** şablonu → Create.
2. **Repo secret'ları:** GitHub → Settings → Secrets and variables → Actions → New repository secret
   - `CLOUDFLARE_API_TOKEN` = oluşturduğun token
   - `CLOUDFLARE_ACCOUNT_ID` = Cloudflare ana sayfasındaki Account ID (birden fazla hesabın varsa gerekli)
3. **Pages:** Settings → Pages → Source: **GitHub Actions**.
4. Actions → **Deploy** → Run workflow. Sonrasında `main`'e her push'ta sunucu ve oyun birlikte güncellenir.

İş akışı Worker'ı yükler, adresini `config.json` olarak siteye koyar ve siteyi GitHub Pages'e yayınlar.

## Geliştirme
- Oyun: `src/head.html` + `src/game.js`; `python3 build.py <three.min.js yolu>` three.js r128'i gömerek `index.html`'i üretir.
- Sunucu: `cd server && npm i && npx wrangler dev --var ALLOWED_ORIGINS:*`; yerelde denemek için kök dizine `{"server":"http://localhost:8787"}` içeren bir `config.json` koyup siteyi bir HTTP sunucusuyla aç.
- Sunucu sadece `ALLOWED_ORIGINS` (varsayılan `https://eosyam.github.io`) adresinden gelen bağlantıları kabul eder.
- İlerleme tarayıcının `localStorage`'ında tutulur; liderlik tablosuna her oyuncu yalnızca kendi tarayıcısındaki gizli anahtarla yazabilir.
