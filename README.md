# SZPGold Board Railway Worker

## ساختار
```
SZPGold_Board_Railway/
├── server.js          # ورکر اصلی (فقط API + WebSocket)
├── package.json       # وابستگی‌ها (express + ws + cors)
├── .gitignore
├── README.md          # این فایل
└── public/            # فایل‌های تابلو (GitHub Pages)
    ├── index.html
    ├── board.js       # تابلو با fetch اولیه از Railway
    ├── logo.png
    ├── bg.jpg
    ├── barash.ttf
    ├── bnazanin.ttf
    ├── btitr.ttf
    └── notification.mp3
```

## معماری

```
Tabl (GitHub Pages) ← آدرس ثابت: akafshdouz.github.io/SZPGold_Board_Railway/
    ↓
    ۱. صفحه باز میشه → fetch از Railway → آخرین قیمت + وضعیت + زمان
    ۲. بعدش WebSocket وصل میشه → بروزرسانی لحظه‌ای
    
Railway Worker ← ۲۴ ساعته وصل به pusher.goldab.ir
    ↓
    GET /api/last-data → آخرین قیمت + وضعیت بازار + زمان
    GET /health → وضعیت سرور
```

## راهنمای Deploy روی Railway

### اولین بار
۱. وارد railway.app بشو
۲. New Project → Deploy from GitHub repo → `SZPGold_Board_Railway` رو انتخاب کن
۳. Railway خودکار `npm install` و `npm start` رو اجرا میکنه
۴. Settings → Networking → Generate Domain
۵. آدرس رو کپی کن (مثلاً `xyz.up.railway.app`)

### آپدیت آدرس Railway توی تابلو
۱. تو GitHub، فایل `public/board.js` رو باز کن
۲. خط سوم رو پیدا کن:
```js
const SERVER_URL = "szpgoldboardrailway-production.up.railway.app";
```
۳. آدرس جدید Railway رو جایگزین کن
۴. Commit changes

### وقتی Railway credit تموم شد
۱. حساب جدید Railway باز کن
۲. همین repo رو دوباره deploy کن
۳. آدرس جدید رو بگیر
۴. خط سوم `public/board.js` رو آپدیت کن
۵. Commit → تموم

## API Endpoints

### GET /
وضعیت سرور
```json
{"ok": true, "message": "SZPGold Board API", "connected": true}
```

### GET /health
سلامت سرور
```json
{"ok": true, "connected": true, "lastUpdated": "2025-07-27T12:30:00Z", "uptime": 3600}
```

### GET /api/last-data
آخرین داده‌های ذخیره شده
```json
{
  "marketStatus": {"goldClosed": false, "coinClosed": true},
  "pricingPacket": {...},
  "lastUpdated": "2025-07-27T12:30:00Z",
  "connected": true
}
```

## ورکر (server.js)
- ۲۴ ساعته وصل به `wss://pusher.goldab.ir`
- پکت‌های `homepage_data_updated` ← وضعیت بازار
- پکت‌های `all_systems_pricing_updated` ← قیمت‌ها
- ذخیره در حافظه (RAM)
- riconnect خودکار بعد از قطعی (۳ ثانیه)
- پینگ هر ۳۰ ثانیه
