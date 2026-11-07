# Napake, zaključek in zgodovina – devet nalog #25–#33

7. 11. 2026. Veja `feat/us11-us15-izidi-zgodovina`, devet GitHub Issues v enem PR. Prejšnji PR #38 je združen.

| Naloge | Izvedeno |
| --- | --- |
| #25, #26 / US-11 | API in obrazci več napak po postavki, opis in MINOR/MAJOR, popravek/brisanje do zaključka. Dodajanje zahteva shranjen FAIL. Neskladje ocen/napak je prikazano; ocena se ne spreminja samodejno. |
| #27, #28 / US-12 | Potrditev zaključka, preprečitev ob neshranjenih spremembah, preverjanje popolnosti na strežniku, izračun PASSED/REINSPECTION_REQUIRED/FAILED ter atomarno shranjevanje izida, časa in COMPLETED. |
| #29, #30 / US-13 | API in seznam zaključene zgodovine izbranega lastnega vozila; aktivni/tuji pregledi se ne prikažejo. Prazen seznam nima izmišljenega izida. |
| #31, #32 / US-14 | API in bralni prikaz vozila, izvajalca, dejanskih časov, izida, vseh postavk, opomb in napak. REINSPECTION_REQUIRED ne rezervira novega termina. |
| #33 / US-15 | Administrator prek API bere vsa vozila, rezervacije in aktivne/zaključene preglede, nima pravic do strokovnih sprememb. Administratorski vmesnik #34 ostaja za naslednji dan. |

## Preverjeno

- **44 backend + 33 frontend = 77 avtomatskih testov**, obe TypeScript gradnji.
- Testi pokrijejo vse tri izide, več manjših napak in prednost MAJOR, nepopoln pregled tudi ob MAJOR, ponovljen zaključek, lastništvo in vloge, spremembe po zaključku, prazno zgodovino, bralni prikaz in neshranjene osnutke napak/opomb.
- Integracijski preizkus `npm --prefix backend run test:live:inspections` v začasni Supabase shemi preveri sočasni prevzem, dvojni zaključek (200 + 409) in zaključek sočasno s spremembo resnosti napake. Shranjeni izid se ujema s shranjenimi napakami v obeh dovoljenih vrstnih redih.
- Začasna shema ter izključno testni FK-zapisi Auth se odstranijo. Preizkusi ne ustvarjajo uporabnih računov ali pošiljajo e-pošte. Preverjanje žetonov v testih je nadzorovano, zato ne nadomešča odprte naloge #35.

## SQL in zagon

Nova tabela `defects` je v `database/changes/03-defects.sql`. Nov projekt pripravi datoteke po vrsti: `schema.sql`, spremembe `01`, `02`, `03`. Obstoječi projekt nadgradi samo z manjkajočimi datotekami. Sheme ne zaganjaj ponovno čez obstoječe tabele. Spremembi 02 in 03 sta namenjeni tudi povezani razvojni bazi po preverjenem PR-ju; stanje izvedbe je zabeleženo v README.

Za ročni sprejemni preizkus se prijavi kot preglednik, prevzemi rezervacijo, oceni postavke in dodaj napake. Ob NOT_CHECKED, FAIL brez napake ali PASS z napako se zaključek zavrne. Po veljavnem zaključku se mesto sprosti in podatki postanejo bralni. Kot lastnik vozila osveži zgodovino ter odpri ugotovitve. Kot administrator preveri bralni API; njegov celoten vmesnik je naloga #34.

## Za 8. 11. 2026

- **Doing:** #17 API in #18 vmesnik spremljanja lastnih rezervacij (US-07).
- **To Do:** #34 administratorski vmesnik evidenc, #35 končni preizkus registracije s potrditveno e-pošto.

Teh štirih nalog ta PR ne zapira. Po združitvi je stanje table **27 Done, 2 Doing, 2 To Do**.
