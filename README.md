# 📊 SEO Tools for Jaheshclinic — آنالیز و تحلیل حرفه‌ای SEO

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**یک اپلیکیشن وب مدرن و حرفه‌ای برای آنالیز جامع SEO که منحصرا برای [کلینیک ارتوپدی جهش](https://jaheshclinic.ir) توسعه داده شده اما برای هر وب‌سایتی قابل استفاده است**

[✨ ویژگی‌ها](#-ویژگیها) • [🚀 نصب](#-نصب-و-راهاندازی) • [🔧 پیکربندی](#-پیکربندی-api) • [📡 API](#-مرجع-api) • [🔒 امنیت](#-نکات-امنیتی)

</div>

---

## 🌟 ویژگی‌ها

<table>
<tr>
<td width="50%">

### 💰 حالت Free-first
بدون نیاز به هیچ اشتراک پولی SEO کار می‌کند — با استفاده از کراولر داخلی + Google PageSpeed Insights (API رایگان)

### 🧩 معماری ماژولار
پشتیبانی از **۱۰ ارائه‌دهنده**:
- 🆓 رایگان: PageSpeed, Bing Webmaster
- 🔑 OAuth: Search Console, GA4
- 💎 تجاری: Ahrefs, Semrush, Moz, DataForSEO, SerpApi, Majestic

</td>
<td width="50%">

### ✅ دروازه اعتبارسنجی پیش از اسکن
ارائه‌دهندگان **الزامی** باید قبل از شروع اسکن تست واقعی اتصال را پاس کنند. ارائه‌دهندگان اختیاری در صورت خطا به‌صورت نرم مدیریت می‌شوند.

### 📈 ممیزی جامع
- Technical SEO
- On-Page SEO
- تحلیل محتوا
- Performance / Core Web Vitals
- تحلیل بک‌لینک
- کلمات کلیدی و دیده‌شدن در جستجو

</td>
</tr>
<tr>
<td>

### 🎯 توصیه‌های عملی
هر یافته شامل **شواهد**، **دلیل اهمیت**، **راهنمای گام‌به‌گام رفع**، **برآورد تلاش** و **اولویت** است

### 📄 گزارش‌های HTML مستقل
کاملاً خودکفا، قابل دانلود، سازگار با چاپ، با جداول قابل جستجو و خروجی JSON

</td>
<td>

### 📊 تاریخچه و مقایسه اسکن‌ها
پیشرفت‌ها را در طول زمان ردیابی کرده و دو اسکن را با هم مقایسه کنید

### 🔐 امنیت
رمزنگاری AES-256-GCM اطلاعات، محافظت در برابر SSRF، احترام به robots.txt، User-Agent شناسایی‌پذیر

</td>
</tr>
</table>

---

## 🛠️ تکنولوژی‌های استفاده‌شده

<table align="center">
<thead>
<tr>
<th>لایه</th>
<th>تکنولوژی‌ها</th>
</tr>
</thead>
<tbody>
<tr>
<td>🎨 <b>فرانت‌اند</b></td>
<td>Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query, Recharts, Lucide</td>
</tr>
<tr>
<td>⚙️ <b>بک‌اند</b></td>
<td>Next.js API Routes, لایه یکپارچه‌سازی ارائه‌دهندگان ماژولار</td>
</tr>
<tr>
<td>🗄️ <b>دیتابیس</b></td>
<td>SQLite از طریق Prisma ORM (فایل‌محور، بدون نیاز به دیتابیس خارجی)</td>
</tr>
<tr>
<td>🕷️ <b>کراولر</b></td>
<td>کراولر HTML داخلی با محافظت SSRF (بدون وابستگی خارجی)</td>
</tr>
<tr>
<td>📑 <b>گزارش‌دهی</b></td>
<td>قالب‌های HTML مستقل تولیدشده در سمت سرور با CSS، JS و داده‌های داخلی</td>
</tr>
</tbody>
</table>

---

## 📁 ساختار پروژه

```
.
├── prisma/
│   └── schema.prisma              # اسکیمای دیتابیس (Website, Scan, Issue, ProviderConfig, …)
├── src/
│   ├── app/
│   │   ├── page.tsx               # پوسته اصلی با سایدبار + بخش‌ها
│   │   ├── layout.tsx             # لایه ریشه
│   │   └── api/                   # مسیرهای REST API
│   │       ├── dashboard/         # خلاصه داشبورد
│   │       ├── providers/         # لیست، ذخیره، حذف ارائه‌دهنده
│   │       │   └── [name]/test/   # اعتبارسنجی اتصال
│   │       ├── scans/             # چرخه حیات اسکن
│   │       │   └── [id]/          # جزئیات، گزارش، لغو
│   │       │       └── report/    # تولیدکننده گزارش HTML
│   │       ├── scans/compare/     # مقایسه اسکن‌ها
│   │       ├── validate/          # اندپوینت اعتبارسنجی پیش از اسکن
│   │       └── websites/          # CRUD وب‌سایت‌ها
│   ├── components/
│   │   ├── layout/sidebar.tsx
│   │   ├── sections/              # Dashboard, NewAudit, Results, …
│   │   ├── audit/badges.tsx       # SeverityBadge, ConnectionStateBadge
│   │   └── ui/                    # کامپوننت‌های shadcn/ui
│   └── lib/
│       ├── types.ts               # تایپ‌های TypeScript مشترک
│       ├── crawler.ts             # کراولر با محافظت SSRF
│       ├── scoring.ts             # سیستم امتیازدهی SEO
│       ├── audit/
│       │   ├── index.ts           # ماژول‌های ممیزی
│       │   └── orchestrator.ts    # هماهنگ‌کننده خط لوله ممیزی
│       ├── providers/             # یکپارچه‌سازی ارائه‌دهندگان
│       │   ├── base.ts            # کلاس پایه + helper اعتبارسنجی
│       │   ├── registry.ts        # رجیستری ارائه‌دهندگان
│       │   ├── pagespeed.ts       # Google PageSpeed Insights
│       │   ├── searchconsole.ts   # Google Search Console (OAuth)
│       │   ├── analytics.ts       # Google Analytics Data API (GA4)
│       │   ├── bing.ts            # Bing Webmaster Tools
│       │   ├── ahrefs.ts          # Ahrefs (پولی)
│       │   ├── semrush.ts         # Semrush (پولی)
│       │   ├── moz.ts             # Moz (پولی)
│       │   └── optional-providers.ts # DataForSEO, SerpApi, Majestic
│       ├── report/
│       │   └── generator.ts       # تولیدکننده گزارش HTML مستقل
│       ├── security/
│       │   ├── ssrf.ts            # محافظت SSRF + اعتبارسنجی URL
│       │   └── credentials.ts     # رمزنگاری AES-256-GCM
│       ├── store/
│       │   ├── providers.ts       # CRUD تنظیمات ارائه‌دهنده (رمزنگاری‌شده)
│       │   └── ui.ts              # Zustand UI store
│       ├── db.ts                  # Prisma client singleton
│       └── utils.ts               # helper Tailwind cn()
├── .env.example                   # قالب متغیرهای محیطی
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 نصب و راه‌اندازی

### 📋 پیش‌نیازها

- ✅ Node.js نسخه ۱۸ به بالا یا Bun نسخه ۱٫۰ به بالا
- ✅ فایل‌سیستم سازگار با SQLite (بدون دیتابیس خارجی)

### ⚡ نصب

```bash
# نصب وابستگی‌ها
bun install

# کپی قالب env و تنظیم کلید رمزنگاری
cp .env.example .env

# تولید کلید قوی رمزنگاری:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# خروجی را در .env در فیلد CREDENTIAL_ENCRYPTION_KEY قرار دهید

# اعمال اسکیمای دیتابیس
bun run db:push

# اجرای سرور توسعه
bun run dev
# سپس آدرس http://localhost:3000 را باز کنید
```

---

## 🔧 پیکربندی API

به بخش **API & Services** در سایدبار بروید و هر ارائه‌دهنده را تنظیم کنید:

> **۱.** روی لینک مستندات ارائه‌دهنده کلیک کنید تا API key / اطلاعات OAuth را دریافت کنید
> **۲.** اطلاعات را وارد کنید — کلید قبل از ذخیره با **AES-256-GCM** رمزنگاری می‌شود
> **۳.** روی **Save** کلیک کنید
> **۴.** روی **Test** کلیک کنید تا اعتبارسنجی واقعی اتصال انجام شود
> **۵.** نتیجه اعتبارسنجی مشخص می‌کند که آیا ارائه‌دهنده می‌تواند برای اسکن انتخاب شود یا خیر

### 🟢 راه‌اندازی Free-first (حداقلی)

پیکربندی حداقلی برای یک اسکن مفید:

- ✅ **Google PageSpeed Insights** (رایگان، نیاز به Google API key)
- ✳️ هیچ ارائه‌دهنده دیگری لازم نیست — کراولر داخلی به‌صورت پیش‌فرض اجرا می‌شود

### 💡 افزودنی‌های پیشنهادی

| ارائه‌دهنده | نوع | فایده |
|---|---|---|
| **Google Search Console** | رایگان + OAuth | داده کلمات کلیدی و دیده‌شدن در جستجو |
| **Bing Webmaster Tools** | رایگان + API key | دیده‌شدن در موتور جستجوی Bing |
| **Ahrefs / Semrush / Moz** | 💎 پولی | داده بک‌لینک |

---

## 📡 مرجع API

### 🌐 وب‌سایت‌ها

| متد | مسیر | توضیح |
|---|---|---|
| `GET` | `/api/websites` | لیست وب‌سایت‌ها |
| `POST` | `/api/websites` | ایجاد / به‌روزرسانی وب‌سایت |

### 🔍 اسکن‌ها

| متد | مسیر | توضیح |
|---|---|---|
| `GET` | `/api/scans?websiteId=X&limit=N` | لیست اسکن‌ها |
| `POST` | `/api/scans` | شروع اسکن جدید (ابتدا اعتبارسنجی، اجرای ممیزی در پس‌زمینه) |
| `GET` | `/api/scans/[id]` | جزئیات اسکن + مشکلات |
| `POST` | `/api/scans/[id]/cancel` | لغو اسکن در حال اجرا |
| `GET` | `/api/scans/[id]/report?type=detailed\|executive` | تولید و دانلود گزارش HTML |
| `GET` | `/api/scans/compare?a=ID1&b=ID2` | مقایسه دو اسکن |

### 🔌 ارائه‌دهندگان

| متد | مسیر | توضیح |
|---|---|---|
| `GET` | `/api/providers` | لیست همه ارائه‌دهندگان با وضعیت فعلی |
| `POST` | `/api/providers/[name]` | ذخیره اطلاعات اعتبار |
| `DELETE` | `/api/providers/[name]` | حذف اطلاعات اعتبار |
| `POST` | `/api/providers/[name]/test` | اجرای اعتبارسنجی زنده اتصال |

### ✅ اعتبارسنجی و داشبورد

| متد | مسیر | توضیح |
|---|---|---|
| `POST` | `/api/validate` | اعتبارسنجی پیش از اسکن (اسکنی شروع نمی‌کند) |
| `GET` | `/api/dashboard` | خلاصه داشبورد (وب‌سایت‌ها، اسکن‌های اخیر، سلامت ارائه‌دهندگان) |

---

## 🎯 ماتریس قابلیت ارائه‌دهندگان

| ارائه‌دهنده | Tech | On-Page | Content | Perf | Backlinks | Keywords | Local | سطح |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **PageSpeed Insights** | — | — | — | ✅ | — | — | — | 🆓 Free tier |
| **Search Console** | ✅ | — | — | — | — | ✅ | — | 🔑 OAuth |
| **Google Analytics GA4** | — | — | — | — | — | ✅ | — | 🔑 OAuth |
| **Bing Webmaster** | — | — | — | — | — | ✅ | — | 🆓 Free tier |
| **Ahrefs** | — | — | — | — | ✅ | ✅ | — | 💎 Paid |
| **Semrush** | — | — | — | — | ✅ | ✅ | — | 💎 Paid |
| **Moz** | — | — | — | — | ✅ | — | — | 💎 Paid |
| **DataForSEO** | — | — | — | — | ✅ | ✅ | — | 💎 Paid |
| **SerpApi** | — | — | — | — | — | ✅ | — | 🆓 Free (100/ماه) |
| **Majestic** | — | — | — | — | ✅ | — | — | 💎 Paid |

---

## 🔒 نکات امنیتی

| 🛡️ ویژگی | توضیح |
|---|---|
| **رمزنگاری AES-256-GCM** | اطلاعات اعتبار با کلید `CREDENTIAL_ENCRYPTION_KEY` از env رمزنگاری می‌شود |
| **دسترسی فقط از بک‌اند** | اطلاعات اعتبار هرگز در پاسخ‌های API، لاگ‌ها یا گزارش‌ها بازگردانده نمی‌شود |
| **محافظت SSRF** | کراولر محدوده‌های IP خصوصی، اندپوینت‌های metadata و مقصدهای redirect را مسدود می‌کند |
| **محدودیت پروتکل** | فقط URLهای `http://` و `https://` کراول می‌شوند |
| **احترام به robots.txt** | قواعد Allow/Disallow مربوط به `User-agent: *` رعایت می‌شود (قابل تنظیم برای هر اسکن) |
| **User-Agent شناسایی‌پذیر** | `Z-SEO-Auditor/1.0` در تمام درخواست‌های کراولر اعلام می‌شود |
| **محدودسازی درخواست** | همزمانی، timeout و تعداد retry قابل تنظیم برای جلوگیری از overload سرور |

---

## 📉 محدودیت‌های Free-tier

> ⚠️ **توجه:** هر ارائه‌دهنده رایگان محدودیت‌های خودش را دارد. برنامه‌ریزی متناسب توصیه می‌شود.

| ارائه‌دهنده | محدودیت |
|---|---|
| **کراولر داخلی** | ۱ تا ۵۰۰ صفحه در هر اسکن (قابل تنظیم توسط کاربر) |
| **PageSpeed Insights** | ۲۵٬۰۰۰ درخواست در روز برای هر پروژه Google Cloud |
| **SerpApi** | ۱۰۰ جستجو در ماه در پلن رایگان |
| **Bing Webmaster** | نیاز به تأیید مالکیت سایت؛ داده محدود به ترافیک Bing |
| **Ahrefs / Semrush / Moz / Majestic** | بدون دسترسی API رایگان؛ تحلیل کامل نیاز به اشتراک پولی دارد |
| **Search Console / Analytics** | نیاز به رضایت OAuth کاربر برای هر property تأییدشده |

---

## 🧮 قوانین امتیازدهی SEO

امتیاز کلی = **میانگین وزنی امتیازهای دسته‌بندی‌ها**. هر دسته از **۱۰۰** شروع می‌شود و به‌ازای هر مشکل کسر می‌شود:

<table>
<thead>
<tr>
<th>شدت</th>
<th>کسر امتیاز</th>
<th>نشان</th>
</tr>
</thead>
<tbody>
<tr><td>🔴 Critical</td><td align="center">−۲۵</td><td>بحرانی</td></tr>
<tr><td>🟠 High</td><td align="center">−۱۲</td><td>بالا</td></tr>
<tr><td>🟡 Medium</td><td align="center">−۶</td><td>متوسط</td></tr>
<tr><td>🔵 Low</td><td align="center">−۲</td><td>پایین</td></tr>
<tr><td>⚪ Informational</td><td align="center">۰</td><td>اطلاعاتی</td></tr>
</tbody>
</table>

### ⚖️ وزن دسته‌بندی‌ها

```
Technical     ████████████████████  30%
On-Page       █████████████████     25%
Content       ██████████            15%
Performance   ██████████            15%
Off-Page      ██████████            15%  (Backlinks + Keywords)
```

> 📌 دسته‌بندی‌هایی که **داده ندارند** از محاسبه امتیاز کل حذف می‌شوند — نه اینکه صفر حساب شوند. بنابراین نبود داده امتیاز را جریمه نمی‌کند.

> ⚠️ **هشدار مهم:** این امتیاز یک **متریک تشخیصی تولیدشده توسط اپلیکیشن** است، نه یک رتبه رسمی Google. از آن برای ردیابی پیشرفت در یک سایت خاص استفاده کنید، نه برای مقایسه با سایت‌های دیگر.

---

## 💻 دستورات توسعه و Production

```bash
# 🚧 توسعه (ریلود خودکار با تغییر فایل)
bun run dev

# 🧹 Lint
bun run lint

# 🗄️ دیتابیس
bun run db:push        # اعمال اسکیما به SQLite
bun run db:generate    # بازتولید Prisma client
bun run db:migrate     # ایجاد و اجرای migration
bun run db:reset       # حذف و بازسازی (مخرب!)

# 🏗️ Build و اجرای Production
bun run build
bun run start
```

---

## 🚢 استقرار

این یک اپلیکیشن استاندارد **Next.js 16** است و روی هر هاست سازگار با Node.js قابل استقرار است (Vercel، Netlify، Railway، Fly.io، سرور شخصی، Docker و غیره).

### ✅ چک‌لیست استقرار

- [ ] 🔗 `DATABASE_URL` را به یک مسیر پایدار و قابل نوشتن تنظیم کنید
- [ ] 🔑 `CREDENTIAL_ENCRYPTION_KEY` را به یک مقدار تصادفی قوی ۶۴ کاراکتری hex تنظیم کنید — **هرگز بین محیط‌ها بازاستفاده نکنید**
- [ ] 💾 اگر از دیتابیس فایلی پیش‌فرض استفاده می‌کنید، بکاپ دوره‌ای SQLite را پیکربندی کنید
- [ ] 🔒 یک reverse proxy (Caddy, nginx) با HTTPS در جلوی سرور Next.js قرار دهید

---

## 🩺 عیب‌یابی

| 🚨 علامت | 🎯 علت احتمالی | 🔧 راه‌حل |
|---|---|---|
| اسکن بلافاصله با خطای «Pre-scan validation failed» مواجه می‌شود | اطلاعات اعتبار ارائه‌دهنده الزامی ناقص یا نامعتبر است | به Settings بروید → اعتبارها را اصلاح کنید → اسکن را دوباره اجرا کنید |
| اسکن اجرا می‌شود اما «Backlink data unavailable» گزارش می‌دهد | هیچ ارائه‌دهنده بک‌لینک پیکربندی نشده | Ahrefs/Moz/Majestic را پیکربندی کنید (همه پولی) |
| کراولر برای یک هدف «SSRF blocked» گزارش می‌دهد | URL به IP خصوصی یا metadata endpoint resolve می‌شود | از URL عمومی استفاده کنید؛ DNS را بررسی کنید که به IP عمومی resolve شود |
| PageSpeed API خطای ۴۰۳ برمی‌گرداند | API key نامعتبر یا API فعال نیست | API key را بررسی کرده و PageSpeed Insights API را در Google Cloud Console فعال کنید |
| Search Console «permission denied» برمی‌گرداند | توکن OAuth فاقد اسکوپ `webmasters.readonly` است | با اسکوپ صحیح دوباره authorize کنید |
| گزارش HTML باز نمی‌شود | مرورگر فایل محلی با JS را بلاک می‌کند | از گزینه «Open in new tab» در اپلیکیشن استفاده کنید، نه باز کردن مستقیم فایل |

---

<div align="center">

## 📜 لایسنس

**MIT** — استفاده آزاد، مشارکت خوشحال‌کننده! 🎉

---

**ساخته‌شده با ❤️ برای جامعه SEO**

[![Star](https://img.shields.io/badge/⭐_ستاره_بدید-حمایت_کنید-yellow?style=for-the-badge)](https://github.com)
[![Fork](https://img.shields.io/badge/🍴_فورک_کنید-مشارکت-blue?style=for-the-badge)](https://github.com)

</div>
