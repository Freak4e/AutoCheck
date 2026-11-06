# Načrt razvoja MVP

Posodobljeno 6. 11. 2026 na podlagi [uporabniških zgodb](05-uporabniske-zgodbe.md) in [zasnove](04-arhitektura-in-tehnoloski-sklad.md).

## GitHub Projects

[AutoCheck – MVP: Kanban](https://github.com/users/Freak4e/projects/1/views/1) je pogled **Board** s stolpci **To Do**, **Doing**, **Done**, razvrščenimi po polju Status. Vsaka kartica je manjši GitHub Issue z opisom in oznako US; število kartic ne pomeni števila celotnih funkcionalnosti.

Ob odprtem PR za US-08–US-10: **12 Done, 6 Doing, 13 To Do**. Šest nalog #19–#24 je implementiranih, a do združitve ostanejo v Doing. Po združitvi jih prestavimo v Done (18 Done, 13 To Do).

- **Done:** US-01–US-06, po dve implementacijski nalogi za vsako zgodbo (#5–#16). Obseg F01–F03: prijava in vloge, lastna vozila, objava in rezervacija terminov.
- **Doing:** #19–#24: API in UI razporeda, prevzema in kontrolnega seznama. Veja `feat/us08-us10-pregledi`, en PR s Closes povezavo za vsako nalogo.
- **To Do:** preostale naloge F04–F07 in [#35 – dejanska registracija s potrditveno e-pošto](https://github.com/Freak4e/AutoCheck/issues/35). Celotna US-15 ostaja odprta, čeprav je bralni vpogled v vozila za administratorja že pripravljen.

Tabela je posnetek tega razvojnega koraka; vir trenutnega stanja je GitHub Project.

## Izvedene funkcionalnosti

1. F01 / US-01, US-02: registracija, prijava, seja, odjava, profil in pravice. Veja `feat/f01-prijava-in-vloge`, [PR #36](https://github.com/Freak4e/AutoCheck/pull/36), zapira #5–#8.
2. F02/F03 / US-03–US-06: vozila, objava terminov in transakcijska rezervacija. Veja `feat/f02-f03-vozila-in-termini`; PR vsebuje Closes #9 do Closes #16. Na povezani bazi sta izvedeni začetna shema ter sprememba 01.

Testi na tej veji: **62 običajnih avtomatskih testov**, uspešna gradnja obeh delov ter nov integracijski preizkus sočasnega prevzema na Supabase v ločeni začasni shemi. [Poročilo US-08–US-10](10-preverjanje-us08-us10.md). Auth ostaja nadzorovan v testih; #35 se ne zapre.

## Naloge

| Issue | Zgodba | Funkcionalnost | Naloga | Status ob odprtem PR |
| --- | --- | --- | --- | --- |
| [#5](https://github.com/Freak4e/AutoCheck/issues/5) | US-01 | F01 | SQL profili in API priprava računa | Done |
| [#6](https://github.com/Freak4e/AutoCheck/issues/6) | US-01 | F01 | Registracijski obrazec | Done |
| [#7](https://github.com/Freak4e/AutoCheck/issues/7) | US-02 | F01 | Preverjanje prijave in vlog na API | Done |
| [#8](https://github.com/Freak4e/AutoCheck/issues/8) | US-02 | F01 | Prijava, seja in odjava | Done |
| [#9](https://github.com/Freak4e/AutoCheck/issues/9) | US-03 | F02 | API za vnos lastnega vozila | Done |
| [#10](https://github.com/Freak4e/AutoCheck/issues/10) | US-03 | F02 | Obrazec za vnos vozila | Done |
| [#11](https://github.com/Freak4e/AutoCheck/issues/11) | US-04 | F02 | API za branje in popravek vozil | Done |
| [#12](https://github.com/Freak4e/AutoCheck/issues/12) | US-04 | F02 | Seznam in urejanje lastnih vozil | Done |
| [#13](https://github.com/Freak4e/AutoCheck/issues/13) | US-05 | F03 | API in omejitve objave terminov | Done |
| [#14](https://github.com/Freak4e/AutoCheck/issues/14) | US-05 | F03 | Administratorski obrazec za termine | Done |
| [#15](https://github.com/Freak4e/AutoCheck/issues/15) | US-06 | F03 | Transakcijska rezervacija termina | Done |
| [#16](https://github.com/Freak4e/AutoCheck/issues/16) | US-06 | F03 | Izbira vozila in rezervacija termina | Done |
| [#17](https://github.com/Freak4e/AutoCheck/issues/17) | US-07 | F04 | API lastnih odprtih rezervacij | To Do |
| [#18](https://github.com/Freak4e/AutoCheck/issues/18) | US-07 | F04 | Prikaz mojih rezervacij in zamude | To Do |
| [#19](https://github.com/Freak4e/AutoCheck/issues/19) | US-08 | F04 | API razporeda za preglednika | To Do |
| [#20](https://github.com/Freak4e/AutoCheck/issues/20) | US-08 | F04 | Razpored in dovoljena dejanja preglednika | To Do |
| [#21](https://github.com/Freak4e/AutoCheck/issues/21) | US-09 | F04 | Transakcijski prevzem pregleda | Doing |
| [#22](https://github.com/Freak4e/AutoCheck/issues/22) | US-09 | F04 | Povezava prevzema z zaslonom pregleda | To Do |
| [#23](https://github.com/Freak4e/AutoCheck/issues/23) | US-10 | F05 | API ocenjevanja postavk in opomb | Doing |
| [#24](https://github.com/Freak4e/AutoCheck/issues/24) | US-10 | F05 | Kontrolni seznam in shranjevanje opomb | To Do |
| [#25](https://github.com/Freak4e/AutoCheck/issues/25) | US-11 | F06 | API napak z opisom in resnostjo | To Do |
| [#26](https://github.com/Freak4e/AutoCheck/issues/26) | US-11 | F06 | Obrazci za dodajanje in popravek napak | To Do |
| [#27](https://github.com/Freak4e/AutoCheck/issues/27) | US-12 | F07 | Transakcijski zaključek in izračun izida | To Do |
| [#28](https://github.com/Freak4e/AutoCheck/issues/28) | US-12 | F07 | Potrditev zaključka in bralni prikaz | To Do |
| [#29](https://github.com/Freak4e/AutoCheck/issues/29) | US-13 | F07 | API zgodovine lastnega vozila | To Do |
| [#30](https://github.com/Freak4e/AutoCheck/issues/30) | US-13 | F07 | Seznam zgodovine vozila | To Do |
| [#31](https://github.com/Freak4e/AutoCheck/issues/31) | US-14 | F07 | API podrobnosti zaključenega pregleda | To Do |
| [#32](https://github.com/Freak4e/AutoCheck/issues/32) | US-14 | F07 | Bralni prikaz ugotovitev | To Do |
| [#33](https://github.com/Freak4e/AutoCheck/issues/33) | US-15 | F02/F04/F07 | Bralni API evidenc za administratorja | To Do |
| [#34](https://github.com/Freak4e/AutoCheck/issues/34) | US-15 | F02/F04/F07 | Administratorski pregled evidenc | To Do |
| [#35](https://github.com/Freak4e/AutoCheck/issues/35) | US-01, US-02 | F01 | Preverjanje F01 na povezanem Supabase projektu | To Do |

## Nadaljevanje

- Po pregledu PR in SQL spremembe 02 zaključimo #19–#24. Nato dodamo spremljanje lastnih rezervacij (US-07); razpored, prevzem in ocenjevanje so že v tem PR.
- Nato F06: napake po postavkah z resnostjo MINOR/MAJOR in dovoljenim popravljanjem do zaključka.
- Nato F07: atomaren zaključek, izračun izida, zgodovina in bralni prikaz ugotovitev.
- Na koncu povežemo celoten administratorski bralni vpogled US-15 in izvedemo celoten sprejemni scenarij.

F08–F12 niso del MVP. Vsako nalogo razvijamo na ločeni veji, preverimo kriterije, odpremo PR z opisom in Closes povezavo ter po uspešnih preverjanjih in združitvi premaknemo v Done.
