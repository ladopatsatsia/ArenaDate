# Railway-ზე გაშვების გზამკვლევი (Deployment Guide)

ეს დოკუმენტი დეტალურად აღწერს, როგორ გავუშვათ პროექტი (Backend API, PostgreSQL/PostGIS და Frontend Web App) **Railway.app**-ზე.

---

## 1. მომზადება
1. დარეგისტრირდით ან შედით [Railway.app](https://railway.app)-ზე.
2. შექმენით ახალი პროექტი: **"New Project"**.
3. პროექტის კოდი უნდა იყოს თქვენს GitHub რეპოზიტორიაში.

---

## 2. ბაზის (PostgreSQL) დამატება
1. პროექტის შიგნით დააჭირეთ **`+ Create`** -> **`Database`** -> **`Add PostgreSQL`**.
2. დაელოდეთ რამდენიმე წამი, სანამ ბაზა შეიქმნება.
3. ბაზის პარამეტრებში გადადით **"Variables"** ტაბზე: Railway ავტომატურად ქმნის `DATABASE_URL`-ს.
*(შენიშვნა: ჩვენმა კოდმა უკვე იცის `DATABASE_URL`-ის ავტომატური ამოკითხვა და კონვერტაცია EF Core-ის ფორმატში, ასევე მიგრაციების და `postgis`-ის ავტომატური გაშვება).*

---

## 3. Backend სერვისის (Dating.Api) გაშვება
1. პროექტში დააჭირეთ **`+ Create`** -> **`GitHub Repo`** და აირჩიეთ ეს რეპოზიტორია.
2. გადადით შექმნილი სერვისის **Settings**-ში:
   - **Service Name**: შეცვალეთ სახელი, მაგალითად: `backend-api`
   - **Build**:
     - **Dockerfile Path**: `backend/Dating.Api/Dockerfile`
3. გადადით **Variables** ტაბზე და დაამატეთ:
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` *(ან უბრალოდ დააკავშირეთ PostgreSQL სერვისთან)*
   - `ASPNETCORE_ENVIRONMENT`: `Production`
   - `Telegram__BotToken`: `თქვენი_ბოტის_ტოკენი` *(თუ ტელეგრამ ბოტი ჩართულია)*
   - `Telegram__WebAppUrl`: `https://${{dating-web.RAILWAY_PUBLIC_DOMAIN}}` *(ფრონტენდის დომენი)*
4. გადადით **Networking** ტაბზე და დააჭირეთ **"Generate Domain"** (მაგ.: `dating-api-production.up.railway.app`).

---

## 4. Frontend სერვისის (Web App) გაშვება
1. პროექტში დააჭირეთ **`+ Create`** -> **`GitHub Repo`** და კვლავ აირჩიეთ იგივე რეპოზიტორია.
2. გადადით სერვისის **Settings**-ში:
   - **Service Name**: `dating-web`
   - **Build**:
     - **Dockerfile Path**: `mobile/Dockerfile`
3. გადადით **Variables** ტაბზე:
   - `API_URL`: `${{backend-api.RAILWAY_PRIVATE_DOMAIN}}` ან `https://${{backend-api.RAILWAY_PUBLIC_DOMAIN}}`
   *(ეს პარამეტრი ეუბნება Node სერვერს, რომ `/api` და `/hubs` (SignalR WebSocket) რექვესთები გადაამისამართოს backend-ზე).*
4. გადადით **Networking** ტაბზე და დააჭირეთ **"Generate Domain"** (მაგ.: `dating-web-production.up.railway.app`).

---

## 5. Telegram ბოტში დაკავშირება
1. გახსენით `@BotFather` ტელეგრამში.
2. გაუშვით `/mybots` -> აირჩიეთ თქვენი ბოტი -> **Bot Settings** -> **Menu Button** -> **Configure menu button**.
3. ჩაუწერეთ გენერირებული Frontend URL:
   `https://dating-web-production.up.railway.app`

---

## რა გავაკეთეთ ავტომატურად კოდში:
1. **Dynamic Port Binding**: ASP.NET Core და Node.js კითხულობენ Railway-ს დინამიურ `PORT` გარემოს ცვლადს.
2. **Postgres Connection URI Parser**: `DATABASE_URL` (მაგ: `postgresql://postgres:...`) ავტომატურად გარდაიქმნება Npgsql კავშირად.
3. **Automatic EF Migration**: კონტეინერის ჩატვირთვისას ავტომატურად ეშვება მიგრაციები და PostGIS გაფართოება.
4. **Proxy Headers & Forwarding**: Railway-ს SSL პროქსის ჰედერები (`X-Forwarded-Proto`, `X-Forwarded-For`) დამუშავებულია, რათა HTTPS მოთხოვნები არ დაიბლოკოს.
5. **Multi-Stage Dockerfile**: `mobile/Dockerfile` სრულად აკომპილირებს Expo Web-ს და უშვებს მსუბუქი Alpine Node სერვერით.
