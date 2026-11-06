# Razpored, prevzem in kontrolni seznam – US-08–US-10

6. 11. 2026, veja `feat/us08-us10-pregledi`. Šest nalog #19–#24 je pripravljenih za pregled v enem PR. Issues ostanejo odprti in v Doing do združitve.

## Implementirani kriteriji

| Zgodba | Izvedba in preverjanje |
| --- | --- |
| US-08 (#19, #20) | Preglednik vidi razpored in pripadajoče podatke vozila, tudi VIN; API omogoča podrobnosti samo prek rezervacije. Ne dobi splošnega dostopa do vseh vozil. Začetek se omogoči ob začetku termina in prostem mestu. Lasten pregled lahko nadaljuje ali po zaključku odpre samo za branje. Tuji pregled ostane brez dostopa do ugotovitev. |
| US-09 (#21, #22) | Prevzem je transakcija: zaklep rezervacije, preverjanje časa/stanja, IN_PROGRESS, določitev prijavljenega izvajalca ter kopiranje aktivne predloge. Sedem postavk začne z NOT_CHECKED. Zgrešen prevzem, zasedena postaja ali prazna predloga ne pustijo delnih zapisov. Zamujen BOOKED je dovoljeno prevzeti tudi po načrtovanem koncu. |
| US-10 (#23, #24) | Izvajalec svojega IN_PROGRESS izrecno shrani oceno in opombo vsake postavke ter splošno opombo. Ponovno odpiranje obnovi shranjene vrednosti. Oceno lahko vrne na NOT_CHECKED. Kopirana besedila ostanejo nespremenjena. Tuji pregled/postavka in spremembe zaključenega pregleda so zavrnjeni. |

Razpored po osvežitvi pokaže prekoračen konec in zasedeno mesto. Dejanski začetek je ločen od načrtovanega termina. Neshranjene spremembe so označene; vrnitev na razpored, odjava in zapiranje strani opozorijo na izgubo podatkov. Obnavljanje žetona istega uporabnika ne sme odstraniti odprtega urejevalnika.

## Testi

- **Backend: 36 testov** skupaj, od tega 11 novih za razpored, pravice, prevzem, kopijo predloge, rollback prazne predloge, urejanje in bralni dostop.
- **Frontend: 26 testov** skupaj, od tega 7 novih za prevzem, zamudo/zasedenost, konflikt s ponovno osvežitvijo, shranjevanje in ponovno odpiranje ocen/opomb, opozorilo pred izgubo sprememb ter zaključen bralni prikaz in ohranitev neshranjenih opomb ob obnovi žetona.
- Obe TypeScript gradnji.
- `npm --prefix backend run test:live:inspections`: dejanski sočasni PostgreSQL povezavi v začasni shemi na povezanem Supabase projektu. Pri prevzemu iste oziroma različnih rezervacij je rezultat 201 + 409; nastaneta samo en pregled in sedem postavk. Preverjen tudi rollback prazne predloge. Začasna shema in samo ustvarjeni FK-zapisi Auth se odstranijo. Prijava je v testih nadzorovana, uporabni e-poštni računi niso ustvarjeni.

Preizkus na Supabase je uspel. Migracija 02 v aplikacijski shemi `public` v tej fazi **še ni izvedena**; vključena je v PR. Obstoječi poslovni podatki niso bili spremenjeni.

## Priprava za zagon

Po pregledu sprememb v SQL Editorju enkrat izvedi `database/changes/02-inspections-checklist.sql`, za že izvedenima `schema.sql` in spremembo 01. Nato zaženi frontend/backend po README in se prijavi z računom INSPECTOR. Račun osebja pripravi po README.

Za ročni preizkus potrebuješ rezervacijo, katere začetek je že dosežen. Preveri prevzem, vseh sedem postavk, shranjevanje ter nadaljevanje po ponovni prijavi. Z drugim preglednikom preveri zavrnjen prevzem, dokler je mesto zasedeno, in zavrnjen dostop do ugotovitev prvega.

## Meje tega PR

Beleženje napak (US-11), zaključek/izračun izida (US-12), prikaz lastnih rezervacij stranki (US-07) in celoten administratorski vpogled ostajajo v ločenih nalogah. Zaključevanje pregleda v tem PR še ni na voljo, zato dejanski prevzeti pregled ostane IN_PROGRESS do implementacije US-12. Testi bralnega prikaza uporabijo posebej pripravljeno zaključeno stanje; ne trdimo, da implementirajo zaključevanje.

Končni preizkus dejanske registracije s potrditveno e-pošto ostaja #35.
