# Načrt razvoja MVP

Pripravljeno 5. 11. 2026 na podlagi [uporabniških zgodb](05-uporabniske-zgodbe.md) in [zasnove](04-arhitektura-in-tehnoloski-sklad.md).

## GitHub Projects

[AutoCheck – MVP: Kanban](https://github.com/users/Freak4e/projects/1/views/1) uporablja pogled **Board** in polje Status s stolpci **To Do**, **Doing**, **Done**. Vsaka razvojna naloga je GitHub Issue z opisom, oznako US in povezavo na kriterije sprejema.

- **Done:** štiri implementacijske naloge za F01 (US-01, US-02), po uspešnih avtomatskih preverjanjih in združitvi PR.
- **Doing:** natanko dve nalogi za 6. 11. 2026: [API vnosa vozila #9](https://github.com/Freak4e/AutoCheck/issues/9) in [API objave terminov #13](https://github.com/Freak4e/AutoCheck/issues/13). To sta rezervirani nalogi za naslednji razvojni dan; F02 in F03 danes nista implementirana.
- **To Do:** preostale naloge F02–F07 in [preverjanje F01 na pravem Supabase projektu #35](https://github.com/Freak4e/AutoCheck/issues/35).

Stanja v spodnji tabeli so posnetek prvega razvojnega koraka. Za nadaljnje delo je vir trenutnega stanja GitHub Project.

## Obseg prvega koraka

Implementira se samo **F01 – dostop glede na vlogo**: registracija, prijava, seja, odjava, profil in pravice. React strani za vozila, razpored in evidence so začetni zasloni glede na vlogo; poslovne funkcije teh strani še niso implementirane.

SQL vsebuje samo tabelo profiles. Tabele vozil, terminov in pregledov ter sedem postavk predloge dodamo skupaj s pripadajočimi nalogami. To sledi predvideni arhitekturi in omejuje današnji obseg na eno funkcionalnost.

Za F01 uporabljamo vejo `feat/f01-prijava-in-vloge`, opisne commite in PR s `Closes #5`, `Closes #6`, `Closes #7`, `Closes #8`. Ločenega preverjanja #35 ne zapremo, dokler ni izvedeno na povezanem Supabase projektu.

## Razčlenitev zgodb

| Issue | Zgodba | Funkcionalnost | Naloga | Status po prvem koraku |
| --- | --- | --- | --- | --- |
| [#5](https://github.com/Freak4e/AutoCheck/issues/5) | US-01 | F01 | SQL profili in API priprava računa | Done |
| [#6](https://github.com/Freak4e/AutoCheck/issues/6) | US-01 | F01 | Registracijski obrazec | Done |
| [#7](https://github.com/Freak4e/AutoCheck/issues/7) | US-02 | F01 | Preverjanje prijave in vlog na API | Done |
| [#8](https://github.com/Freak4e/AutoCheck/issues/8) | US-02 | F01 | Prijava, seja in odjava | Done |
| [#9](https://github.com/Freak4e/AutoCheck/issues/9) | US-03 | F02 | API za vnos lastnega vozila | Doing |
| [#10](https://github.com/Freak4e/AutoCheck/issues/10) | US-03 | F02 | Obrazec za vnos vozila | To Do |
| [#11](https://github.com/Freak4e/AutoCheck/issues/11) | US-04 | F02 | API za branje in popravek vozil | To Do |
| [#12](https://github.com/Freak4e/AutoCheck/issues/12) | US-04 | F02 | Seznam in urejanje lastnih vozil | To Do |
| [#13](https://github.com/Freak4e/AutoCheck/issues/13) | US-05 | F03 | API in omejitve objave terminov | Doing |
| [#14](https://github.com/Freak4e/AutoCheck/issues/14) | US-05 | F03 | Administratorski obrazec za termine | To Do |
| [#15](https://github.com/Freak4e/AutoCheck/issues/15) | US-06 | F03 | Transakcijska rezervacija termina | To Do |
| [#16](https://github.com/Freak4e/AutoCheck/issues/16) | US-06 | F03 | Izbira vozila in rezervacija termina | To Do |
| [#17](https://github.com/Freak4e/AutoCheck/issues/17) | US-07 | F04 | API lastnih odprtih rezervacij | To Do |
| [#18](https://github.com/Freak4e/AutoCheck/issues/18) | US-07 | F04 | Prikaz mojih rezervacij in zamude | To Do |
| [#19](https://github.com/Freak4e/AutoCheck/issues/19) | US-08 | F04 | API razporeda za preglednika | To Do |
| [#20](https://github.com/Freak4e/AutoCheck/issues/20) | US-08 | F04 | Razpored in dovoljena dejanja preglednika | To Do |
| [#21](https://github.com/Freak4e/AutoCheck/issues/21) | US-09 | F04 | Transakcijski prevzem pregleda | To Do |
| [#22](https://github.com/Freak4e/AutoCheck/issues/22) | US-09 | F04 | Povezava prevzema z zaslonom pregleda | To Do |
| [#23](https://github.com/Freak4e/AutoCheck/issues/23) | US-10 | F05 | API ocenjevanja postavk in opomb | To Do |
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

## Vrstni red nadaljevanja

1. Začnemo dve funkcionalnosti: F02 z API vnosa vozila (#9) in F03 z API objave terminov (#13). Obrazca (#10, #14) sledita uspešnima API nalogama. Nato US-04 dopolni seznam in dovoljen popravek vozila pred prvo rezervacijo.
2. US-05/US-06 dodata objavo terminov in atomarno rezervacijo.
3. US-07–US-09 dodajo spremljanje, razpored in transakcijski prevzem s kopijo sedmih postavk.
4. US-10/US-11 dodata ocenjevanje, opombe in napake.
5. US-12 doda atomaren zaključek ter izračun treh izidov. US-13/US-14 dodata zgodovino in podrobnosti.
6. US-15 poveže bralni administratorski vpogled prek že razvitih evidenc.

Posamezne zgodbe preverjamo s pripravljenimi testnimi podatki; odvisnosti ne zahtevajo združevanja v eno veliko nalogo. F08–F12 ostajajo izven MVP in niso del te table.

## Pravilo dokončanja

Nalogo razvijamo na ločeni veji, preverimo ustrezne kriterije iz 2. naloge, v PR opišemo spremembe in rezultate ter povežemo Issue. Po uspešni gradnji/testih in združitvi v main prestavimo nalogo v Done. Odprte zunanje preizkuse navedemo izrecno, ne označujemo jih kot opravljene.
