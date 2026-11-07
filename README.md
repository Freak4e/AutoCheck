# AutoCheck

Študijska aplikacija za naročanje in evidentiranje tehničnih pregledov na eni manjši postaji. Frontend uporablja **React + TypeScript + Vite**, backend **Node.js + Express + TypeScript**, prijavo in PostgreSQL pa zagotavlja **Supabase**.

## Trenutni obseg

Implementirani so prijava in vloge, vozila, rezervacija terminov, razpored in prevzem, ocenjevanje postavk, napake, zaključek z izračunom izida ter zgodovina in bralne ugotovitve lastnega vozila. Administrator ima pripravljen bralni API. Za jutri ostanejo spremljanje lastnih odprtih rezervacij (US-07), administratorski vmesnik evidenc (#34) in končni prijavni preizkus (#35).

Razčlenitev nalog je v [načrtu MVP](docs/07-nacrt-mvp.md). Današnji korak obsega devet nalog **#25–#33**. Po združitvi PR je stanje Kanbana **27 Done, 2 Doing, 2 To Do**. [Preverjanje današnjega koraka](docs/11-preverjanje-us11-us15.md).

Celotna shema je sestavljena iz `database/schema.sql` in sprememb `01`, `02`, `03` v `database/changes/`. Izvajaj jih po vrsti in samo enkrat. Navodila za prvo pripravo in nadgradnjo so spodaj.

## Predpogoji

- Node.js **24 LTS** z npm (`node --version`, `npm --version`).
- Git in internetna povezava.
- Lasten projekt Supabase z dostopom do SQL Editorja, nastavitev Auth in povezave PostgreSQL.

Docker in lokalna baza nista potrebna. Podatki in računi ostanejo na Supabase tudi po ustavitvi aplikacije. Ukaze izvajaj iz korena repozitorija. **Če PowerShell blokira `npm.ps1`, namesto `npm` uporabi `npm.cmd`**; spreminjanje execution policy ni potrebno.

## 1. Priprava Supabase

1. Ustvari oziroma odpri projekt Supabase.
2. V **SQL Editorju** novega projekta po vrsti enkrat izvedi [schema.sql](database/schema.sql), [spremembo 01](database/changes/01-vehicles-slots-appointments.sql), [spremembo 02](database/changes/02-inspections-checklist.sql) in [spremembo 03](database/changes/03-defects.sql). Na obstoječem projektu izvedi samo manjkajoče spremembe; nobene datoteke ne izvajaj ponovno čez obstoječe tabele. Začetna shema in 01 sta bili na povezani bazi izvedeni 5. 11. 2026; 02 in 03 se izvedeta ob uvedbi PR za zaključevanje in zgodovino.
3. V nastavitvah **Data API** izključi Data API. Poslovni podatki potujejo prek Express API. Auth ostane omogočen. Profili dodatno uporabljajo RLS brez pravil za neposreden dostop.
4. V **Authentication → Sign In / Providers** omogoči e-pošto in geslo. Nastavitev **Confirm email** določa, ali mora uporabnik pred prijavo potrditi e-pošto. Aplikacija upošteva oba načina.
5. V **Authentication → URL Configuration** nastavi **Site URL** na `http://localhost:5173` in isti naslov dodaj med dovoljene preusmeritve.
6. Poišči URL projekta in **publishable key** (`sb_publishable_...`; ustrezen je tudi starejši javni ključ `anon`). V frontend nikoli ne vpisuj skrivnega ključa oziroma `service_role`.
7. V **Connect → Session pooler** kopiraj povezavo PostgreSQL (vrata 5432). Geslo v URI URL-kodiraj, če vsebuje npr. `@`, `#`, `:` ali `/`. Ne dodajaj parametrov `sslmode`, `sslcert`, `sslkey` ali `sslrootcert`: TLS nastavi backend in preveri certifikat. Če potrebuješ Supabase CA certifikat, ga prenesi iz nastavitev baze in nastavi `DATABASE_CA_CERT_PATH`.

## 2. Lokalne nastavitve

V PowerShellu kopiraj vzorca samo ob prvi pripravi; ne prepisuj že izpolnjenih datotek:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

V `frontend/.env` izpolni:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

V `backend/.env` izpolni:

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
DATABASE_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@SESSION_POOLER_HOST:5432/postgres
PORT=3000
# Neobvezno: pot relativno glede na backend/.
# DATABASE_CA_CERT_PATH=./certs/prod-supabase.cer
```

Oba dela morata kazati na isti projekt. `.env` in certifikati ne sodijo v Git. Po spremembi nastavitev ponovno zaženi oba strežnika.

## 3. Namestitev in zagon

Namestitev točnih različic iz lock datotek:

```powershell
npm --prefix frontend ci
npm --prefix backend ci
```

Prvi terminal – backend:

```powershell
npm --prefix backend run dev
```

Drugi terminal – frontend:

```powershell
npm --prefix frontend run dev
```

Odpri **http://localhost:5173**. Backend posluša na **http://localhost:3000**; Vite mu posreduje zahteve `/api`. `GET /api/health` preveri proces, ne povezave z bazo ali Auth. Za preverjanje obeh storitev se prijavi in preveri prikaz imena ter vloge.

Procesa ustaviš s `Ctrl+C`. Port 5173 je fiksen zaradi potrditvene e-pošte. Če spremeniš backend `PORT`, prilagodi tudi cilj proxyja v `frontend/vite.config.ts`.

## 4. Računi in vloge

- Registracija vedno ustvari **stranko (`CUSTOMER`)**. Vloga ni polje obrazca. Profil nastane šele po preverjeni prijavi prek `POST /api/auth/profile`.
- Ob vključeni potrditvi e-pošte odpri prejeto povezavo. Pri ponovni registraciji iste e-pošte sledi navodilu za prijavo; Supabase lahko zaradi varovanja podatkov vrne enak odgovor kot pri novi registraciji.
- Za preglednika in administratorja ustvari računa v **Authentication → Users**, nato v SQL Editorju pripravi profila z dejanskima UUID-jema:

```sql
INSERT INTO public.profiles (id, name, role)
VALUES
  ('UUID_PREGLEDNIKA', 'Preglednik', 'INSPECTOR'),
  ('UUID_ADMINISTRATORJA', 'Administrator', 'ADMIN');
```

Če profila že obstajata, uporabi ciljan `UPDATE public.profiles SET role = 'INSPECTOR' WHERE id = 'DEJANSKI_UUID';` oziroma `ADMIN`. To je ročna priprava osebja. Aplikacija ob ponovni prijavi obstoječega imena ali vloge ne prepiše.

Stranka vnese vozilo, rezervira termin in bere zgodovino ter ugotovitve zaključenih pregledov. Preglednik vidi razpored, prevzame rezervacijo, izrecno shrani ocene/opombe in napake ter potrdi zaključek. Strežnik preveri popolnost, izračuna izid in sprosti pregledno mesto. Zaključenih ugotovitev ni mogoče spreminjati. Administrator ima bralni API; celoten vmesnik evidenc je še v #34.

## Preverjanje in gradnja

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
```

Običajnih **77 avtomatskih testov** ne potrebuje pravih ključev. Auth je v testih nadzorovan, SQL pa preverjamo v začasnem PostgreSQL okolju PGlite. Kriteriji US-01/US-02 so v [preverjanju F01](docs/08-preverjanje-f01.md), vozila in rezervacije pa v [preverjanju F02/F03](docs/09-preverjanje-f02-f03.md).

Dodaten preizkus sočasnosti na bazi iz `backend/.env` zaženeš izrecno:

```powershell
npm --prefix backend run test:live
```

Preizkus ustvari začasne UUID-zapise za profile, vozila in termine ter jih po zaključku odstrani. Ne ustvarja uporabnih prijavnih računov in ne pošilja e-pošte. Uporablja dejanske transakcije in sočasne PostgreSQL povezave. Na povezanem Supabase projektu je bil uspešno izveden; dejanska registracija s potrditveno e-pošto ostaja v Issue #35.

Preveden backend: `npm --prefix backend start`. Predogled prevedenega frontenda: `npm --prefix frontend run preview -- --port 5173`; backend mora teči. To ni navodilo za produkcijsko gostovanje.

### Pogoste težave

- **Manjkajo nastavitve:** izpolni obe `.env`; frontend pokaže navodilo, backend se ustavi z imeni manjkajočih spremenljivk.
- **Prijava ni potrjena:** preveri e-pošto in URL v Supabase. Geslo mora ustrezati pravilom tvojega projekta Supabase.
- **Profil se ne naloži:** preveri backend, izvedbo SQL sheme, geslo baze in povezavo Session pooler.
- **Napaka certifikata:** nastavi pravi CA certifikat; ne izklapljaj preverjanja TLS.
- **Zasedena vrata:** ustavi stari proces; frontend ne preklopi samodejno na drug port.

## Struktura repozitorija

```text
frontend/       React vmesnik, seja Supabase, obrazci, testi
backend/        Express API, preverjanje prijave in vlog, SQL profili, testi
database/       začetna SQL shema za trenutno implementirani obseg
docs/           zasnova, uporabniške zgodbe, wireframe-i, načrt in preverjanje
```

## Dokumentacija

1. [Zasnova rešitve](docs/01-zasnova-resitve.md)
2. [Funkcionalnosti in obseg](docs/02-funkcionalnosti-in-obseg.md)
3. [Podatkovni model](docs/03-podatkovni-model.md)
4. [Arhitektura in tehnološki sklad](docs/04-arhitektura-in-tehnoloski-sklad.md)
5. [Uporabniške zgodbe in kriteriji sprejema](docs/05-uporabniske-zgodbe.md)
6. [Wireframe-i](docs/06-wireframes.md)
7. [Načrt MVP in GitHub naloge](docs/07-nacrt-mvp.md)
8. [Preverjanje F01](docs/08-preverjanje-f01.md)
9. [Preverjanje F02/F03](docs/09-preverjanje-f02-f03.md)
10. [Preverjanje US-08–US-10](docs/10-preverjanje-us08-us10.md)
11. [Preverjanje US-11–US-15](docs/11-preverjanje-us11-us15.md)

[ADR-ji](docs/adr/) pojasnjujejo arhitekturne odločitve. Dokumenti prvih dveh nalog opisujejo celoten načrtovani MVP; zgornji trenutni obseg pove, kaj je že implementirano.

## Razvojni postopek: GitHub Flow

1. Nalogo premaknemo iz `To Do` v `Doing`.
2. Iz posodobljene `main` odpremo vejo, npr. `feat/us03-vnos-vozila`.
3. Implementiramo izbrano nalogo in preverimo kriterije njene uporabniške zgodbe.
4. Ustvarimo opisne commite, npr. `feat: dodaj API za lastna vozila (#12)`.
5. Odpremo PR z opisom sprememb, preverjanj in povezavo `Closes #12`.
6. Po preverjanju združimo PR v `main` in nalogo označimo `Done`.

`.env`, gesel in ključev ne vključujemo v commit; `.env.example` in `package-lock.json` sodita v repozitorij.
