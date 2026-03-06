# Literature Platform Frontend

O'zbek adabiyotini raqamlashtirishga qaratilgan platformaning frontend qismi.
Foydalanuvchilar kitoblarni o'qish, audio tinglash, progressni saqlash,
sevimlilarga qo'shish va reyting qoldirish imkoniga ega. Admin panel orqali
kontent boshqariladi.

## Asosiy imkoniyatlar

- Guest sahifa va umumiy tanishtiruv bloklari.
- Autentifikatsiya: ro'yxatdan o'tish, login, email tasdiqlash.
- Profil boshqaruvi va profil rasmi yangilash.
- Dashboard:
- O'qilgan kitoblar soni.
- Mutolaa vaqti (oxirgi 7 kun va bugun).
- "Siz uchun" tavsiyalar (top reyting).
- "Eng ko'p o'qilganlar" (top 100 ko'rish).
- Kitoblar:
- Kitoblar ro'yxati va qidiruv.
- Kitob detail sahifasi (tavsif, meta, reyting va review).
- PDF reader (zoom, sahifa boshqaruvi).
- Audio player (orqaga/oldinga, pauza, tezlik).
- Progress saqlash va tiklash (PDF + audio).
- Admin panel (SUPERADMIN):
- Kitoblar CRUD.
- Muqova, PDF va audio upload.
- PDF sahifa sonini avtomatik aniqlash.
- Mualliflar, kategoriyalar, foydalanuvchilar boshqaruvi.
- Light/Dark mode va responsiv dizayn.

## Texnologiyalar

- React + TypeScript
- Vite
- Tailwind CSS
- Axios
- React Router
- React Toastify
- React PDF (pdf.js)

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzer: `http://localhost:5173`

## Backend sozlamalari

API base URL `src/services/api.ts` ichida:

```ts
const API_URL = "http://localhost:8080";
```

Backend manzili o'zgarsa shu yerda yangilang.

## Muhim routelar

- `/dashboard` - user dashboard
- `/books` - kitoblar ro'yxati
- `/books/:bookId` - kitob detail
- `/books/:bookId/read` - PDF reader
- `/books/:bookId/audio` - audio player
- `/books/siz-uchun` - tavsiyalar (top reyting)
- `/books/top-kitoblar` - eng ko'p o'qilganlar
- `/profile` - foydalanuvchi profili
- `/admin/*` - admin panel

## PDF reader API

- GET `/api/books/{bookId}/progress`
- PUT `/api/books/{bookId}/progress`
- POST `/api/books/{bookId}/start`
- POST `/api/books/sessions/start`
- POST `/api/books/sessions/end` yoki `/api/books/sessions/end-active`
- POST `/api/books/{bookId}/favorite`
- POST `/api/books/{bookId}/rating`

## Audio API

- GET `/api/books/{bookId}/audio`
- GET `/api/me/books/{bookId}/audio`
- POST `/api/me/books/{bookId}/audio/save?duration=SECONDS`

## Admin upload API

- POST `/api/books/{id}/cover`
- POST `/api/books/file/pdf/{id}` (multipart/form-data, `pageCount` bilan)
- POST `/api/books/file/audio/{id}`

## Tavsiyalar va top kitoblar

- GET `/api/me/books/siz-uchun` (top reyting)
- GET `/api/me/books/top-kitoblar` (top 100 ko'rish)

## Skriptlar

- `npm run dev` - development server
- `npm run build` - production build
- `npm run preview` - buildni local ko'rish
- `npm run lint` - lint tekshiruvi

## Eslatma

PDF worker `react-pdf` bilan mos bo'lishi kerak.
Loyiha `pdfjs-dist` workerini `?url` orqali ulaydi.
