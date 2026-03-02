# Literature Platform Frontend

O'zbek adabiyotini raqamlashtirishga qaratilgan platformaning frontend qismi.
Foydalanuvchilarga kitoblarni o'qish, progressni saqlash, sevimlilarga qo'shish
va reyting qoldirish imkonini beradi. Admin panel orqali kontent boshqariladi.

## Asosiy imkoniyatlar

- Landing (guest) sahifa, mualliflar va saralangan kitoblar bloklari.
- Autentifikatsiya: ro'yxatdan o'tish, login, email tasdiqlash.
- Profil va profil rasmi boshqaruvi.
- PDF reader:
  - Progress GET/PUT (sahifa, bob).
  - O'qish sessiyasi start/end.
  - Sevimliga qo'shish (toggle).
  - Reyting va fikr qoldirish.
  - Zoom, sahifa o'zgartirish, loading va error holatlari.
- Admin panel (SUPERADMIN):
  - Kitoblar CRUD, muqova va PDF upload.
  - PDF yuklanganda sahifa sonini avtomatik aniqlash.
  - Mualliflar, kategoriyalar, foydalanuvchilar boshqaruvi.
- Mobil + noutbuk uchun responsiv dizayn.

## Texnologiyalar

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Axios
- React Router
- React Hook Form + Yup
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

- `/books` — kitoblar ro'yxati
- `/books/:bookId/read` — PDF reader
- `/profile` — foydalanuvchi profili
- `/admin/*` — admin panel

## PDF Reader qisqacha

Reader sahifasi:

- GET `/api/books/{bookId}/progress`
- PUT `/api/books/{bookId}/progress` (debounce bilan)
- POST `/api/books/{bookId}/start`
- POST `/api/books/sessions/start`
- POST `/api/books/sessions/end` yoki `/api/books/sessions/end-active`
- POST `/api/books/{bookId}/favorite`
- POST `/api/books/{bookId}/rating`

## Admin PDF upload

Admin panelda PDF yuklash:

- `/api/books/file/pdf/{id}` (multipart/form-data)
- `pageCount` form-data orqali yuboriladi (avtomatik hisoblanadi).

## Skriptlar

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — buildni local ko'rish
- `npm run lint` — lint tekshiruvi

## Eslatma

PDF worker versiyasi `react-pdf` bilan mos bo'lishi kerak.
Bu loyiha `pdfjs-dist` workerini `?url` orqali ulaydi.
