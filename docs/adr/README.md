# Arhitekturne odločitve AutoCheck

Ti ADR-ji beležijo odločitve, že sprejete v dokumentaciji prve naloge; status **Sprejeto** pomeni sprejeto zasnovo, ne že izdelane aplikacije. Alternative in njihove primerjave so naknadna razlaga izbire, ne trditev, da so bile vse možnosti prej preizkušene. Dokumentacija ne navaja razvijalčevih izkušenj s posameznimi ogrodji, zato jih ne predpostavljamo. Skupni TypeScript zmanjšuje število jezikov, ki jih je treba uporabljati in vzdrževati.

| ADR | Odločitev | Status |
| --- | --- | --- |
| [0001](0001-izbira-react-typescript-vite.md) | React, TypeScript, Vite in navaden CSS | Sprejeto |
| [0002](0002-izbira-express-api.md) | En Express REST API za poslovna pravila in pravice | Sprejeto |
| [0003](0003-izbira-supabase.md) | Gostovani PostgreSQL in Supabase Auth ob lokalni aplikaciji | Sprejeto |
| [0004](0004-izbira-sql-in-transakcij.md) | Neposreden SQL prek `pg`, omejitve in transakcije | Sprejeto |
| [0005](0005-izbira-priprave-baze-s-sql.md) | Ročna priprava baze s shranjenimi SQL datotekami | Sprejeto |
| [0006](0006-izbira-ohranjanja-zgodovine.md) | Kopije postavk in nespremenljivi zaključeni pregledi | Sprejeto |

## Predloga in postopek

[Predloga](adr-template.md) je slovenska prilagoditev [uradne minimalne predloge MADR](https://github.com/adr/madr/blob/main/template/adr-template-minimal.md), preverjene 24. 10. 2026. Ohranja kontekst, možnosti, odločitev z utemeljitvijo in posledice; dodaja zahtevani status. [Uradna navodila MADR](https://adr.github.io/madr/#applying-madr-to-your-project) opisujejo shranjevanje odločitev v Markdown in zaporedno oštevilčenje. Uporabljamo mapo `docs/adr/`.

Za novo odločitev kopiramo predlogo v `NNNN-kratek-opis.md` z naslednjo številko, dopolnimo razloge in povezave na izhodišča ter jo pregledamo v PR. Ob spremembi sprejete odločitve ustvarimo nov ADR s povezavo »Nadomešča ADR-NNNN«. Stari zapis ohranimo in njegov status spremenimo v »Nadomeščeno z ADR-NNNN« s povezavo na novi dokument. Posodobimo tudi kazalo in prizadeto zasnovo; zgodovine razlogov ne prepišemo.
