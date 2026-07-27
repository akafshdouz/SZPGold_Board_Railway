# SZPGold Board - Railway Worker

## ساختار
```
├── server.js          # ورکر اصلی (WebSocket + HTTP)
├── package.json       # وابستگی‌ها
├── public/            # فایل‌های استاتیک تابلو
│   ├── index.html     # صفحه تابلو
│   ├── board.js       # اسکریپت تابلو (fetch + WebSocket)
│   └── logo.png       # لوگو
└── .gitignore
```

##HOW TO DEPLOY ON RAILWAY
1. یک repository در GitHub بساز
2. این فایل‌ها را Push کن
3. در Railway → New Project → Deploy from GitHub repo
4. Railway خودکار پورت را پیدا می‌کند (متغیر PORT)

## HOW TO UPDATE RAILWAY URL
وقتی Railway جدید ساختی، فقط در فایل `public/board.js` خط اول را تغییر بده:
```js
const SERVER_URL = "your-new-url.up.railway.app";
```
Commit + Push → تمام
