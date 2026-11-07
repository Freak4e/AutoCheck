# Načrt razvoja MVP

Posodobljeno 7. 11. 2026. [Kanban Board](https://github.com/users/Freak4e/projects/1/views/1) uporablja stolpce To Do, Doing in Done. Posamezna kartica je manjša izvedljiva naloga, ne cela funkcionalnost.

Po združitvi današnjega PR: **27 Done, 2 Doing, 2 To Do**. Devet današnjih nalog je #25–#33: napake, zaključek, zgodovina in podrobnosti (API/UI) ter administratorski bralni API. Predhodni PR #38 za #19–#24 je združen.

Za **8. 11. 2026** sta v Doing #17/#18 (lastne rezervacije); v To Do ostaneta #34 (administratorski vmesnik) in #35 (resnični prijavni preizkus s potrditvijo e-pošte). Te štiri naloge še niso dokončane.

## Naloge po združitvi PR

| Issue | Zgodba | Naloga | Status |
| --- | --- | --- | --- |
| [#5](https://github.com/Freak4e/AutoCheck/issues/5) | US-01 | SQL profili in API priprava računa | Done |
| [#6](https://github.com/Freak4e/AutoCheck/issues/6) | US-01 | Registracijski obrazec | Done |
| [#7](https://github.com/Freak4e/AutoCheck/issues/7) | US-02 | Preverjanje prijave in vlog na API | Done |
| [#8](https://github.com/Freak4e/AutoCheck/issues/8) | US-02 | Prijava, seja in odjava | Done |
| [#9](https://github.com/Freak4e/AutoCheck/issues/9) | US-03 | API za vnos lastnega vozila | Done |
| [#10](https://github.com/Freak4e/AutoCheck/issues/10) | US-03 | Obrazec za vnos vozila | Done |
| [#11](https://github.com/Freak4e/AutoCheck/issues/11) | US-04 | API za branje in popravek vozil | Done |
| [#12](https://github.com/Freak4e/AutoCheck/issues/12) | US-04 | Seznam in urejanje lastnih vozil | Done |
| [#13](https://github.com/Freak4e/AutoCheck/issues/13) | US-05 | API in omejitve objave terminov | Done |
| [#14](https://github.com/Freak4e/AutoCheck/issues/14) | US-05 | Administratorski obrazec za termine | Done |
| [#15](https://github.com/Freak4e/AutoCheck/issues/15) | US-06 | Transakcijska rezervacija termina | Done |
| [#16](https://github.com/Freak4e/AutoCheck/issues/16) | US-06 | Izbira vozila in rezervacija termina | Done |
| [#17](https://github.com/Freak4e/AutoCheck/issues/17) | US-07 | API lastnih odprtih rezervacij | Doing |
| [#18](https://github.com/Freak4e/AutoCheck/issues/18) | US-07 | Prikaz mojih rezervacij in zamude | Doing |
| [#19](https://github.com/Freak4e/AutoCheck/issues/19) | US-08 | API razporeda za preglednika | Done |
| [#20](https://github.com/Freak4e/AutoCheck/issues/20) | US-08 | Razpored in dovoljena dejanja preglednika | Done |
| [#21](https://github.com/Freak4e/AutoCheck/issues/21) | US-09 | Transakcijski prevzem pregleda | Done |
| [#22](https://github.com/Freak4e/AutoCheck/issues/22) | US-09 | Povezava prevzema z zaslonom pregleda | Done |
| [#23](https://github.com/Freak4e/AutoCheck/issues/23) | US-10 | API ocenjevanja postavk in opomb | Done |
| [#24](https://github.com/Freak4e/AutoCheck/issues/24) | US-10 | Kontrolni seznam in shranjevanje opomb | Done |
| [#25](https://github.com/Freak4e/AutoCheck/issues/25) | US-11 | API napak z opisom in resnostjo | Done |
| [#26](https://github.com/Freak4e/AutoCheck/issues/26) | US-11 | Obrazci za dodajanje in popravek napak | Done |
| [#27](https://github.com/Freak4e/AutoCheck/issues/27) | US-12 | Transakcijski zaključek in izračun izida | Done |
| [#28](https://github.com/Freak4e/AutoCheck/issues/28) | US-12 | Potrditev zaključka in bralni prikaz | Done |
| [#29](https://github.com/Freak4e/AutoCheck/issues/29) | US-13 | API zgodovine lastnega vozila | Done |
| [#30](https://github.com/Freak4e/AutoCheck/issues/30) | US-13 | Seznam zgodovine vozila | Done |
| [#31](https://github.com/Freak4e/AutoCheck/issues/31) | US-14 | API podrobnosti zaključenega pregleda | Done |
| [#32](https://github.com/Freak4e/AutoCheck/issues/32) | US-14 | Bralni prikaz ugotovitev | Done |
| [#33](https://github.com/Freak4e/AutoCheck/issues/33) | US-15 | Bralni API evidenc za administratorja | Done |
| [#34](https://github.com/Freak4e/AutoCheck/issues/34) | US-15 | Administratorski pregled evidenc | To Do |
| [#35](https://github.com/Freak4e/AutoCheck/issues/35) | US-01, US-02 | Preverjanje F01 na povezanem Supabase projektu | To Do |

## Preverjanje

77 avtomatskih testov (44 backend, 33 frontend), gradnji obeh delov in izoliran preizkus sočasnih transakcij na Supabase. [Poročilo](11-preverjanje-us11-us15.md) pojasni izide, zaščito podatkov ter razliko med nadzorovanim Auth v testih in še odprtim #35.

Razvoj poteka na ločenih vejah prek PR z opisnimi commiti in Closes povezavami. Done pomeni uspešno preverjeno in združeno spremembo. F08–F12 ostajajo izven MVP.
