# AutoCheck

Študijska aplikacija za naročanje in evidentiranje tehničnih pregledov na eni manjši postaji. Frontend uporablja **React + TypeScript + Vite**, backend **Node.js + Express + TypeScript**, prijavo in PostgreSQL pa zagotavlja **Supabase**.

## Trenutni obseg

Implementirani so **F01–F03 (US-01–US-06)**: registracija, prijava in vloge; vnos, seznam in dovoljen popravek lastnih vozil; administratorska objava 30-minutnih terminov ter rezervacija termina za lastno vozilo. Administrator ima bralni vpogled v vozila. F04–F07 (razpored, prevzem, ugotovitve in zgodovina pregledov) še čakajo na razvoj.

Razčlenitev nalog in povezave na GitHub so v [načrtu MVP](docs/07-nacrt-mvp.md). Za naslednji razvojni dan sta v `Doing` API prevzema pregleda (F04, #21) in API kontrolnega seznama (F05, #23). Status pomeni načrtovano nadaljevanje, ne že izdelane funkcije.

## Predpogoji

- Node.js **24 LTS** z npm (`node --version`, `npm --version`).
- Git in internetna povezava.
- Lasten projekt Supabase z dostopom do SQL Editorja, nastavitev Auth in povezave PostgreSQL.

Docker in lokalna baza nista potrebna. Podatki in računi ostanejo na Supabase tudi po ustavitvi aplikacije. Ukaze izvajaj iz korena repozitorija. **Če PowerShell blokira `npm.ps1`, namesto `npm` uporabi `npm.cmd`**; spreminjanje execution policy ni potrebno.

## 1. Priprava Supabase

1. Ustvari oziroma odpri projekt Supabase.
2. V **SQL Editorju** novega projekta po vrsti enkrat izvedi [database/schema.sql](database/schema.sql) (profili) in [database/changes/01-vehicles-slots-appointments.sql](database/changes/01-vehicles-slots-appointments.sql) (vozila, termini, rezervacije). Če F01 že uporabljaš, izvedi samo drugo datoteko. Skript ne izvajaj ponovno čez obstoječo shemo. V povezanem razvojnem projektu sta bili obe že izvedeni 5. 11. 2026.
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

Stranka po prijavi na strani »Moja vozila« vnese vozilo, popravi podatke pred prvo rezervacijo ter rezervira prost termin. Po rezervaciji je vozilo zaklenjeno za popravljanje, termin pa izgine iz ponudbe. Administrator v »Evidencah postaje« objavi termin in bere vozila. Preglednikov razpored je še ogrodje za F04. Seznam že ustvarjenih rezervacij in zgodovina sta naslednji nalogi; trenutni zaslon pokaže potrditev pravkar ustvarjene rezervacije.

## Preverjanje in gradnja

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
```

Običajnih **44 avtomatskih testov** ne potrebuje pravih ključev. Auth je v testih nadzorovan, SQL pa preverjamo v začasnem PostgreSQL okolju PGlite. Kriteriji US-01/US-02 so v [preverjanju F01](docs/08-preverjanje-f01.md), vozila in rezervacije pa v [preverjanju F02/F03](docs/09-preverjanje-f02-f03.md).

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

[ADR-ji](docs/adr/) pojasnjujejo arhitekturne odločitve. Dokumenti prvih dveh nalog opisujejo celoten načrtovani MVP; zgornji trenutni obseg pove, kaj je že implementirano.

## Razvojni postopek: GitHub Flow

1. Nalogo premaknemo iz `To Do` v `Doing`.
2. Iz posodobljene `main` odpremo vejo, npr. `feat/us03-vnos-vozila`.
3. Implementiramo izbrano nalogo in preverimo kriterije njene uporabniške zgodbe.
4. Ustvarimo opisne commite, npr. `feat: dodaj API za lastna vozila (#12)`.
5. Odpremo PR z opisom sprememb, preverjanj in povezavo `Closes #12`.
6. Po preverjanju združimo PR v `main` in nalogo označimo `Done`.

`.env`, gesel in ključev ne vključujemo v commit; `.env.example` in `package-lock.json` sodita v repozitorij.
