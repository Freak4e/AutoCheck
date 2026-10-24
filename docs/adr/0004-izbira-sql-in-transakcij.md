# 0004 – Neposreden SQL, omejitve in transakcije prek pg

**Status:** Sprejeto

## Kontekst in problem

[Podatkovni model](../03-podatkovni-model.md#celovitost-in-transakcije) zahteva preprečevanje dvojne rezervacije, največ en aktiven pregled ter skladen zaključek. Sočasne zahteve ne smejo pustiti delnih zapisov. [Tehnološki sklad](../04-arhitektura-in-tehnoloski-sklad.md#tehnologije-in-utemeljitev-izbire) določa `pg`, parametrizirane poizvedbe in uporabo omejitev PostgreSQL brez ORM.

## Obravnavane možnosti

- **SQL prek `pg` in transakcije:** neposreden nadzor nad poizvedbami, zaklepanjem in omejitvami; SQL in preslikavo rezultatov pišemo sami.
- **ORM s podporo transakcijam:** zmanjša del ponavljajočega se preslikovanja, vendar doda odvisnost in način dela, posebne omejitve PostgreSQL pa še vedno zahtevajo razumevanje SQL.
- **Zaporedne poizvedbe brez skupne transakcije, samo preverjanje v aplikaciji:** manj začetne kode, a ob napaki ali sočasnih zahtevah ne zagotavlja dogovorjene celovitosti.

## Odločitev

Izbrana možnost je **parametriziran SQL prek `pg`, transakcije in podatkovne omejitve**. Za osem tabel je neposreden SQL dovolj pregleden, omogoča izrecno zaklepanje in ne zahteva učenja dodatne abstrakcije ORM. Baza uveljavlja tuje ključe, dovoljene vrednosti, enoličnost in neprekrivanje terminov; backend preverja uporabniške pravice in domenska pravila.

Rezervacija, prevzem in zaključek so ločene transakcije. Rezervacija zaklene izbrani termin; začetek, urejanje ugotovitev in zaključek zaklenejo pripadajočo rezervacijo z `SELECT … FOR UPDATE`. Delna enolična indeksa preprečita več odprtih rezervacij vozila in več aktivnih pregledov postaje. Ob zaključku se izid, čas in `COMPLETED` shranijo skupaj. Potek rezervacije ostane ločen od izida pregleda, kot določa model.

### Posledice

- Pozitivno: napaka razveljavi povezane spremembe; omejitve baze preprečujejo tudi konflikte med sočasnimi zahtevami.
- Pozitivno: poizvedbe in transakcijske meje so vidne v majhnem backendu, brez dodatnega ORM in njegovega vzdrževanja.
- Negativno: razvijalec mora razumeti SQL, zaklepe, rollback in sproščanje povezav; tipizacijo rezultatov in preslikavo podatkov pripravi sam.
- Negativno: delne indekse in izključitveno omejitev vežemo na PostgreSQL. Pravilnost bo treba preveriti tudi s sočasnimi zahtevami proti API in bazi.
