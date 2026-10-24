# AutoCheck

AutoCheck je študijska spletna aplikacija za naročanje in evidentiranje tehničnih pregledov vozil na eni manjši postaji. Rezervacije, podatke vozil, ugotovitve preglednika in zgodovino združuje na enem mestu namesto v ločenih koledarjih, preglednicah in papirnih zapisnikih.

Projekt je **v fazi načrtovanja**. Repozitorij vsebuje dokumentacijo prvih dveh nalog, wireframe-e in zapise arhitekturnih odločitev. Aplikacija še ni implementirana; `frontend/` in `backend/` vsebujeta samo `.gitkeep`.

## Vloge in obseg MVP

- **Stranka:** registracija in prijava, vnos lastnih vozil, rezervacija prostega termina ter pregled lastnih rezultatov in zgodovine.
- **Preglednik:** razpored postaje, prevzem rezervacije, ocenjevanje kontrolnega seznama, beleženje napak in zaključek pregleda.
- **Administrator:** objava prostih terminov in bralni vpogled v evidence postaje.

MVP obsega funkcionalnosti F01–F07: eno postajo, eno pregledno mesto, 30-minutne termine in sedem postavk kontrolnega seznama. Potek rezervacije je `BOOKED → IN_PROGRESS → COMPLETED`; izid pregleda izračuna backend. Upravljanje osebja in predloge, urejanje terminov, prestavitev rezervacije in statistika (F08–F12) so poznejše nadgradnje.

Gre za učno simulacijo brez povezave z uradnimi evidencami ali merilnimi napravami. Izid `PASSED` ne pomeni uradne registracije vozila.

## Izbrane tehnologije

| Del | Dogovorjena izbira |
| --- | --- |
| Uporabniški vmesnik | React, TypeScript, Vite in navaden CSS |
| Lastni REST API | Node.js, Express in TypeScript |
| Podatki | PostgreSQL na Supabase; parametrizirani SQL in transakcije prek `pg` na backendu |
| Prijava | Supabase Auth in `@supabase/supabase-js` |
| Priprava baze | Shranjene SQL datoteke in Supabase SQL Editor |
| Razvoj | Node.js, npm, Git in lokalne datoteke `.env` |

Frontend in backend bosta tekla lokalno, baza in prijava na Supabase; razvoj zahteva internetno povezavo. Poslovni podatki bodo dostopni prek Express API, Supabase Data API bo izključen. Zasnova ne uporablja Dockerja, ORM ali mikrostoritev. Različice odvisnosti bodo ob implementaciji zapisane v `package-lock.json`.

## Struktura repozitorija

```text
AutoCheck/
├── README.md
├── .gitignore
├── frontend/
│   └── .gitkeep
├── backend/
│   └── .gitkeep
└── docs/
    ├── 01-zasnova-resitve.md
    ├── 02-funkcionalnosti-in-obseg.md
    ├── 03-podatkovni-model.md
    ├── 04-arhitektura-in-tehnoloski-sklad.md
    ├── 05-uporabniske-zgodbe.md
    ├── 06-wireframes.md
    ├── wireframes/          # vseh 9 prikazov v PNG in SVG
    ├── images/              # obstoječi diagram poteka pregleda
    ├── tools/               # obstoječa skripta za izdelavo wireframe-ov
    └── adr/                 # kazalo, minimalna predloga MADR in 6 ADR-jev
```

Mapa `database/` in izvorna koda iz načrta arhitekture bosta nastali šele ob implementaciji.

## Dokumentacija

1. [Zasnova rešitve](docs/01-zasnova-resitve.md)
2. [Funkcionalnosti in obseg](docs/02-funkcionalnosti-in-obseg.md)
3. [Podatkovni model](docs/03-podatkovni-model.md)
4. [Arhitektura in tehnološki sklad](docs/04-arhitektura-in-tehnoloski-sklad.md)
5. [Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md)
6. [Wireframe-i](docs/06-wireframes.md)

[Arhitekturne odločitve (ADR)](docs/adr/) pojasnjujejo razloge za že izbrano zasnovo. Ob spremembi sprejete odločitve ustvarimo nov ADR, ki navede, katerega nadomešča; starega ohranimo in označimo kot nadomeščenega s povezavo na novega.

## Razvojni postopek: GitHub Flow

1. Iz posodobljene `main` ustvarimo kratkotrajno vejo, npr. `chore/priprava-repozitorija-adr` ali `feat/rezervacija-termina`.
2. Spremembe izvedemo na veji, pregledamo diff in opravimo preverjanja, primerna spremembi. Dokumentaciji preverimo povezave in skladnost; ob implementaciji tudi delovanje.
3. Shranimo smiseln commit, vejo potisnemo na GitHub in odpremo pull request (PR) v `main` z opisom sprememb in preverjanj.
4. Pregledamo PR in ga združimo po običajnem postopku. Nato lokalno posodobimo `main`. Spremembe v `main` vnašamo prek PR.

Datotek `.env`, gesel in ključev ne vključujemo v commit. `.env.example` sme vsebovati le vzorčne vrednosti; lock datoteke sodijo v repozitorij.

### Zaščita veje main

Ciljne nastavitve so obvezen PR, **0 zahtevanih odobritev**, prepoved force push in brisanja ter veljavnost pravil tudi za administratorja. Obvezni CI testi, code-owner odobritve in odobritev zadnjega potiska niso zahtevani.

**Stanje ob preverjanju 24. 10. 2026:** repozitorij je zaseben. GitHub API kljub administratorskemu dostopu vrne `403` z zahtevo po GitHub Pro oziroma javnem repozitoriju. Zaščite zato ni mogoče nastaviti ali potrditi kot aktivne; vidnost ostaja zasebna. GitHub Flow se do omogočene zaščite izvaja po dogovoru, brez strežniškega uveljavljanja teh pravil.

Za dokončanje zaščite lastnik omogoči GitHub Pro za račun, ki je lastnik repozitorija, nato v [nastavitvah vej](https://github.com/Freak4e/AutoCheck/settings/branches) izbere **Add classic branch protection rule** za `main`:

- Vključi **Require a pull request before merging**; **Require approvals** pusti izključeno (0 odobritev).
- **Require review from Code Owners**, **Require approval of the most recent reviewable push** in **Require status checks to pass before merging** pusti izključeno.
- Vključi **Do not allow bypassing the above settings**.
- **Allow force pushes** in **Allow deletions** pusti izključeno ter shrani pravilo.

Nato preveri shranjeno pravilo in da naslednji PR ne zahteva odobritve druge osebe. Omejitev paketov opisuje [uradna dokumentacija zaščitenih vej](https://docs.github.com/en/rest/branches/branch-protection).
