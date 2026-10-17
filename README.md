ابزار تخصصی آنالیز سئو — وب اپلیکیشن کامل تحلیل سئو

یک برنامه وب مدرن و حرفه‌ای که برای کلینیک ارتوپدی جهش توسعه داده شده اما برای هر وب‌سایت عمومیِ قابل دسترسی، حسابرسی جامع سئو انجام می‌دهد. این پروژه با Next.js 16، TypeScript، Tailwind CSS، Prisma و یک لایه ماژولار یکپارچه‌سازی ارائه‌دهنده‌ها ساخته شده است.

> نسخه اختصاصی برای: [جهش کلینیک](https://jaheshclinic.ir)

امکانات

- حالت رایگان-محور: بدون نیاز به هیچ اشتراک پولی سئو کار می‌کند؛ با استفاده از خزنده فنی داخلی سئو + Google PageSpeed Insights (رایگان).
- یکپارچه‌سازی ماژولار ارائه‌دهنده‌ها با پشتیبانی از 10 ارائه‌دهنده:
  - رایگان / دارای پلن رایگان: Google PageSpeed Insights، Bing Webmaster Tools
  - نیازمند OAuth: Google Search Console، Google Analytics Data API (GA4)
  - تجاری (اختیاری): Ahrefs، Semrush، Moz، DataForSEO، SerpApi، Majestic
- دروازه اعتبارسنجی اجباری پیش از اسکن: ارائه‌دهنده‌های الزامی باید قبل از شروع اسکن، تست اتصال واقعی را پاس کنند. ارائه‌دهنده‌های اختیاری در صورت خطا به‌صورت Graceful مدیریت می‌شوند.
- حسابرسی جامع: سئو فنی، سئو On-Page، تحلیل محتوا، عملکرد / Core Web Vitals، تحلیل بک‌لینک، کلمات کلیدی / دیده‌شدن در جستجو.
- توصیه‌های قابل اجرا: هر یافته شامل مدرک، دلیل اهمیت، راهنمای گام‌به‌گام رفع مشکل، برآورد تلاش و اولویت است.
- گزارش‌های HTML مستقل: قابل دانلود، مناسب چاپ، با جداول قابل جستجوی مشکلات و امکان خروجی JSON.
- تاریخچه اسکن و مقایسه: پیشرفت را در طول زمان پیگیری کنید و دو اسکن را مقایسه کنید.
- امنیت: ذخیره‌سازی رمزنگاری‌شده اعتبارنامه‌ها با AES-256-GCM، دسترسی به رازها فقط در بک‌اند، محافظت در برابر SSRF، رعایت robots.txt، و User-Agent قابل شناسایی برای خزنده.

تکنولوژی‌ها

- فرانت‌اند: Next.js 16 (App Router)، TypeScript 5، Tailwind CSS 4، shadcn/ui، Zustand، TanStack Query، Recharts، آیکون‌های Lucide
- بک‌اند: Routeهای API سمت سرور در Next.js، لایه یکپارچه‌سازی ماژولار ارائه‌دهنده‌ها
- پایگاه‌داده: SQLite از طریق Prisma ORM (فایل‌محور، بدون نیاز به دیتابیس خارجی)
- خزنده: خزنده HTML داخلی با محافظت SSRF (بدون وابستگی خارجی)
- گزارش‌سازی: قالب‌های HTML مستقل تولیدشده توسط سرور با CSS، JS و داده‌های جاسازی‌شده

ساختار پروژه

```text
.
├── prisma/
│   └── schema.prisma              # اسکیمای دیتابیس (Website, Scan, Issue, ProviderConfig و غیره)
├── src/
│   ├── app/
│   │   ├── page.tsx                # شل اصلی با سایدبار + بخش‌ها
│   │   ├── layout.tsx              # لایوت ریشه
│   │   └── api/                    # Routeهای REST API
│   │       ├── dashboard/          # خلاصه داشبورد
│   │       ├── providers/          # لیست، ذخیره، حذف ارائه‌دهنده‌ها
│   │       │   └── [name]/test/    # اعتبارسنجی اتصال
│   │       ├── scans/              # چرخه حیات اسکن
│   │       │   └── [id]/           # جزئیات اسکن، گزارش، لغو
│   │       │       └── report/     # تولیدکننده گزارش HTML
│   │       ├── scans/compare/      # مقایسه اسکن‌ها
│   │       ├── validate/           # اندپوینت اعتبارسنجی پیش از اسکن
│   │       └── websites/           # CRUD وب‌سایت‌ها
│   ├── components/
│   │   ├── layout/sidebar.tsx
│   │   ├── sections/                # Dashboard, NewAudit, Results, Recommendations, Reports, History, ApiSettings, AppSettings
│   │   ├── audit/badges.tsx         # SeverityBadge, ConnectionStateBadge
│   │   └── ui/                     # کامپوننت‌های shadcn/ui
│   └── lib/
│       ├── types.ts                # تایپ‌های مشترک TypeScript
│       ├── crawler.ts              # خزنده وب‌سایت با محافظت SSRF
│       ├── scoring.ts              # سیستم امتیازدهی سئو
│       ├── audit/
│       │   ├── index.ts            # ماژول‌های حسابرسی (Technical, OnPage, Content, Performance, Backlink, Keyword)
│       │   └── orchestrator.ts     # هماهنگ‌کننده پایپ‌لاین حسابرسی
│       ├── providers/               # یکپارچه‌سازی ارائه‌دهنده‌ها
│       │   ├── base.ts              # کلاس انتزاعی BaseProvider + helper validateProvider
│       │   ├── registry.ts          # رجیستری ارائه‌دهنده‌ها
│       │   ├── pagespeed.ts         # Google PageSpeed Insights
│       │   ├── searchconsole.ts    # Google Search Console (OAuth)
│       │   ├── analytics.ts         # Google Analytics Data API (GA4, OAuth)
│       │   ├── bing.ts              # Bing Webmaster Tools
│       │   ├── ahrefs.ts            # Ahrefs (پولی)
│       │   ├── semrush.ts           # Semrush (پولی)
│       │   ├── moz.ts               # Moz (پولی)
│       │   └── optional-providers.ts # DataForSEO, SerpApi, Majestic
│       ├── report/
│       │   └── generator.ts        # تولیدکننده گزارش HTML مستقل
│       ├── security/
│       │   ├── ssrf.ts              # محافظت SSRF + اعتبارسنجی URL
│       │   └── credentials.ts      # رمزنگاری AES-256-GCM
│       ├── store/
│       │   ├── providers.ts        # CRUD پیکربندی ارائه‌دهنده‌ها (رمزنگاری‌شده)
│       │   └── ui.ts               # استور UI با Zustand
│       ├── db.ts                   # تک‌نمونه Prisma client
│       └── utils.ts                # helper مربوط به cn() در Tailwind
├── .env.example                    # قالب متغیرهای محیطی
├── package.json
├── tsconfig.json
└── README.md
```

راه‌اندازی و نصب

پیش‌نیازها

- Node.js 18+ یا Bun 1.0+
- فایل‌سیستم سازگار با SQLite (بدون نیاز به دیتابیس خارجی)

نصب

```bash
# نصب وابستگی‌ها
bun install

# کپی قالب env و تنظیم کلید رمزنگاری
cp .env.example .env
# تولید یک کلید رمزنگاری قوی:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# خروجی را در فایل .env به‌عنوان CREDENTIAL_ENCRYPTION_KEY قرار دهید

# اعمال اسکیمای دیتابیس
bun run db:push

# اجرای سرور توسعه
bun run dev
# بازدید از http://localhost:3000
```

پیکربندی API

بخش API & Services را در سایدبار باز کنید تا هر ارائه‌دهنده را پیکربندی کنید:

1. روی لینک مستندات ارائه‌دهنده کلیک کنید تا API key / اطلاعات OAuth را دریافت کنید.
2. اعتبارنامه‌ها را در فرم وارد کنید. کلید قبل از ذخیره‌سازی رمزنگاری می‌شود (AES-256-GCM).
3. روی Save کلیک کنید تا ذخیره شود.
4. روی Test کلیک کنید تا اعتبارسنجی اتصال واقعی در برابر API ارائه‌دهنده اجرا شود.
5. نتیجه اعتبارسنجی تعیین می‌کند که آیا آن ارائه‌دهنده برای اسکن قابل انتخاب است یا خیر.

راه‌اندازی حالت رایگان-محور

حداقل پیکربندی برای یک اسکن مفید:
- Google PageSpeed Insights (رایگان، نیازمند Google API key)
- هیچ ارائه‌دهنده دیگری لازم نیست — خزنده داخلی به‌صورت پیش‌فرض اجرا می‌شود

افزونه‌های پیشنهادی

- Google Search Console (رایگان، نیازمند OAuth): داده کلمات کلیدی و دیده‌شدن در جستجو
- Bing Webmaster Tools (رایگان، نیازمند API key): دیده‌شدن در موتور جستجوی Bing
- Ahrefs / Semrush / Moz (پولی): داده بک‌لینک

مرجع API

وب‌سایت‌ها
- `GET /api/websites` — لیست وب‌سایت‌ها
- `POST /api/websites` — ایجاد/به‌روزرسانی وب‌سایت

اسکن‌ها
- `GET /api/scans?websiteId=X&limit=N` — لیست اسکن‌ها
- `POST /api/scans` — شروع اسکن جدید (ابتدا اعتبارسنجی؛ اجرای حسابرسی در پس‌زمینه)
- `GET /api/scans/[id]` — دریافت جزئیات اسکن + مشکلات
- `POST /api/scans/[id]/cancel` — لغو اسکن در حال اجرا
- `GET /api/scans/[id]/report?type=detailed|executive` — تولید و دانلود گزارش HTML
- `GET /api/scans/compare?a=ID1&b=ID2` — مقایسه دو اسکن

ارائه‌دهنده‌ها
- `GET /api/providers` — لیست همه ارائه‌دهنده‌ها با وضعیت فعلی
- `POST /api/providers/[name]` — ذخیره اعتبارنامه‌ها
- `DELETE /api/providers/[name]` — حذف اعتبارنامه‌ها
- `POST /api/providers/[name]/test` — اجرای اعتبارسنجی اتصال زنده

اعتبارسنجی و داشبورد
- `POST /api/validate` — اعتبارسنجی پیش از اسکن (اسکن را شروع نمی‌کند)
- `GET /api/dashboard` — خلاصه داشبورد (وب‌سایت‌ها، اسکن‌های اخیر، سلامت ارائه‌دهنده‌ها)

ماتریس قابلیت ارائه‌دهنده‌ها

ارائه‌دهنده	فنی	On-Page	محتوا	عملکرد	بک‌لینک	کلمات کلیدی	محلی	سطح دسترسی	
PageSpeed Insights	—	—	—	✓	—	—	—	پلن رایگان	
Search Console	✓	—	—	—	—	✓	—	نیازمند OAuth	
Google Analytics GA4	—	—	—	—	—	✓	—	نیازمند OAuth	
Bing Webmaster	—	—	—	—	—	✓	—	پلن رایگان	
Ahrefs	—	—	—	—	✓	✓	—	پولی	
Semrush	—	—	—	—	✓	✓	—	پولی	
Moz	—	—	—	—	✓	—	—	پولی	
DataForSEO	—	—	—	—	✓	✓	—	پولی	
SerpApi	—	—	—	—	—	✓	—	پلن رایگان (100/ماه)	
Majestic	—	—	—	—	✓	—	—	پولی	

نکات امنیتی

- رمزنگاری AES-256-GCM برای اعتبارنامه‌ها با کلیدی از متغیر محیطی `CREDENTIAL_ENCRYPTION_KEY`.
- دسترسی به رازها فقط در بک‌اند — اعتبارنامه‌ها هرگز در پاسخ‌های API، لاگ‌ها یا گزارش‌ها برگردانده نمی‌شوند.
- محافظت SSRF — خزنده بازه‌های IP خصوصی، اندپوینت‌های متادیتا و مقصد ریدایرکت‌ها را مسدود و دوباره اعتبارسنجی می‌کند.
- محدودیت پروتکل — فقط URLهای `http://` و `https://` خزیده می‌شوند.
- رعایت robots.txt — از قوانین User-agent: * و Allow/Disallow پیروی می‌کند (قابل تنظیم برای هر اسکن).
- User-Agent قابل شناسایی — `Z-SEO-Auditor/1.0` در همه درخواست‌های خزنده اعلام می‌شود.
- Throttling درخواست‌ها — هم‌زمانی، تایم‌اوت و محدودیت تلاش مجدد قابل تنظیم، برای جلوگیری از فشار روی سرور.

محدودیت‌های پلن رایگان

- خزنده داخلی: 1 تا 500 صفحه در هر اسکن (قابل تنظیم توسط کاربر). هر اسکن برای جلوگیری از فشار روی سرور مقصد، محدود است.
- PageSpeed Insights: 25,000 درخواست در روز برای هر پروژه Google Cloud (سهمیه پیش‌فرض).
- SerpApi: 100 جستجو در ماه در پلن رایگان.
- Bing Webmaster: نیازمند مالکیت تأییدشده سایت؛ داده‌ها محدود به ترافیک جستجوی Bing هستند.
- Ahrefs / Semrush / Moz / Majestic: بدون دسترسی رایگان به API؛ تحلیل کامل بک‌لینک/کلمات کلیدی نیازمند اشتراک پولی است.
- Google Search Console / Analytics: نیازمند رضایت OAuth کاربر برای هر property تأییدشده.

قوانین امتیازدهی سئو

امتیاز کلی = میانگین وزنی امتیاز دسته‌ها. هر دسته از 100 شروع می‌شود و به ازای هر مشکل جریمه می‌گیرد:

شدت	جریمه	
بحرانی	-25	
بالا	-12	
متوسط	-6	
پایین	-2	
اطلاعاتی	0	

وزن دسته‌ها: فنی 30%، On-Page 25%، محتوا 15%، عملکرد 15%، Off-Page (بک‌لینک + کلمات کلیدی) 15%.

دسته‌هایی که داده ندارند از مجموع نهایی حذف می‌شوند، نه اینکه صفر لحاظ شوند؛ بنابراین نبود داده باعث افت امتیاز نمی‌شود.

نکته: این امتیاز یک معیار تشخیصی تولیدشده توسط برنامه است، نه امتیاز رسمی رتبه‌بندی گوگل. از آن برای پیگیری پیشرفت در طول زمان در یک وب‌سایت مشخص استفاده کنید، نه برای مقایسه با سایت‌های دیگر.

دستورات توسعه و پروداکشن

```bash
# توسعه (بارگذاری خودکار با تغییر فایل)
bun run dev

# Lint
bun run lint

# دیتابیس
bun run db:push        # اعمال اسکیما روی SQLite
bun run db:generate    # بازتولید Prisma client
bun run db:migrate     # ایجاد و اعمال migration
bun run db:reset       # حذف و بازسازی (تخریبی)

# بیلد و اجرای پروداکشن (در پیش‌نمایش sandbox استفاده نمی‌شود)
bun run build
bun run start
```

دیپلوی

این یک اپ استاندارد Next.js 16 است و می‌تواند روی هر هاستی که Node.js را پشتیبانی کند دیپلوی شود (Vercel، Netlify، Railway، Fly.io، سرور خودتان، Docker و غیره).

چک‌لیست مهم دیپلوی:
1. `DATABASE_URL` را روی یک مسیر فایل پایدار و قابل نوشتن تنظیم کنید.
2. `CREDENTIAL_ENCRYPTION_KEY` را روی یک مقدار تصادفی قوی 64 کاراکتری hex تنظیم کنید. هرگز آن را بین محیط‌ها تکرار نکنید.
3. اگر از دیتابیس فایل‌محور پیش‌فرض استفاده می‌کنید، بکاپ دوره‌ای SQLite را تنظیم کنید.
4. یک reverse proxy (Caddy، nginx) با HTTPS جلوی سرور Next.js پیکربندی کنید.

رفع اشکال

علامت	علت محتمل	راه‌حل	
اسکن بلافاصله با خطای «Pre-scan validation failed» شکست می‌خورد	اعتبارنامه ارائه‌دهنده الزامی وجود ندارد یا نامعتبر است	Settings را باز کنید → اعتبارنامه‌ها را اصلاح کنید → دوباره اسکن را اجرا کنید	
اسکن اجرا می‌شود اما «Backlink data unavailable» گزارش می‌دهد	هیچ ارائه‌دهنده بک‌لینکی پیکربندی نشده است	Ahrefs/Moz/Majestic را پیکربندی کنید (همه پولی هستند)	
خزنده برای یک هدف «SSRF blocked» گزارش می‌دهد	URL به IP خصوصی یا اندپوینت متادیتا resolve می‌شود	از یک URL عمومی استفاده کنید؛ بررسی کنید DNS به یک IP عمومی resolve شود	
PageSpeed API کد 403 برمی‌گرداند	API key نامعتبر است یا PageSpeed Insights API در پروژه Google Cloud فعال نیست	API key را دوباره بررسی کنید؛ API را در Google Cloud Console فعال کنید	
Search Console خطای «permission denied» می‌دهد	توکن OAuth اسکوپ `webmasters.readonly` ندارد	با اسکوپ درست دوباره مجوز دهید	
گزارش HTML باز نمی‌شود	مرورگر فایل محلی با JS را مسدود می‌کند	به‌جای ذخیره و باز کردن از روی دیسک، از گزینه «Open in new tab» در اپ استفاده کنید	

لایسنس

MIT
