# Zaključek MVP – 8. 11. 2026

Zadnji nalogi: #34 (US-15, administratorske evidence) in #35 (dejanski Auth, US-01/US-02). Nova SQL migracija ni potrebna.

## Administratorski vmesnik

- Prikazuje vsa vozila, rezervacije in preglede, s sporočili za prazne sezname.
- Iz vozila filtrira pripadajoče rezervacije in preglede. Rezervacija odpre podatke vozila ali pripadajoči pregled. BOOKED brez pregleda izpiše »Pregled še ni začet«.
- Aktiven pregled ima trenutne ocene, opombe in napake brez končnega izida; zaključen ima čas zaključka in shranjeni izid. Prikazana sta preglednik in vozilo.
- Podrobnosti so bralne. Ni urejanja vozil, prevzema, ocenjevanja, urejanja napak ali zaključevanja. API omejitve ostajajo preverjene v backend testih.
- Objava terminov ostane ločen obrazec. Ni upravljanja uporabnikov, predlog ali statistike F08/F10/F12.
- Osvežitev znova naloži evidence; napake imajo možnost ponovitve, zastarel odgovor podrobnosti se po spremembi vozila zavrže.

## Dejanski Supabase in brskalnik

Uporabljen je bil uporabnikov potrjeni testni e-poštni naslov. Geslo je naključno ustvarjeno in shranjeno le lokalno v prezrti datoteki; osebni podatki in žetoni niso v repozitoriju. Registracija je bila izvedena prek pravega Supabase SDK. Dostavo in odprtje potrditvenega sporočila je potrdil uporabnik; prijavo in odjavo je nato preveril Playwright v Edge s pravim React vmesnikom, Express API in Supabase Auth.

| Preverjanje | Rezultat |
| --- | --- |
| Registracija | Nastal je dejanski Auth račun, brez seje pred potrditvijo. |
| Prijava pred potrditvijo | Zavrnjena z email_not_confirmed. |
| Potrditev e-pošte | Uporabnik odprl prejeto povezavo; Auth vrne potrjen naslov in uspešno prijavo. |
| Napačno geslo | invalid_credentials, brez seje. |
| Priprava profila | Prvi klic 201, nadaljnji 200; UUID je od preverjenega uporabnika, vloga CUSTOMER kljub podtaknjenima ID in ADMIN. |
| Ponovna registracija | Prikrit odgovor brez seje; SQL potrdi natanko en Auth račun za ta naslov. |
| Vse tri vloge | Prava prijava v brskalniku odpre /vozila, /razpored oziroma /evidence. |
| Obnova seje | Osvežitev brskalnika ohrani prijavo; dejanski refresh token uspešno obnovi sejo. |
| Ponovna priprava profila | Ne prepiše obstoječe vloge. |
| Matrika pravic | Lastni prostor 200, druga dva prostora 403 za vsako vlogo. Brez žetona 401, tuj profil 404. |
| Odjava | Vsaka vloga se vrne na prijavo; tudi osvežitev po odjavi ostane na prijavi. |

Za preverjanje treh vlog je bil isti testni račun zaporedoma nastavljen na CUSTOMER, INSPECTOR in ADMIN; za vsako vlogo je bil uporabljen nov brskalnikov kontekst in prava prijava. Po testu je vloga vrnjena na CUSTOMER. Nastavitve potrditve e-pošte niso bile izključene. Naravnega izteka dostopnega žetona nismo čakali; preverjena je dejanska obnova seje, ne takojšnja globalna razveljavitev izdanih žetonov ob odjavi.

## Dokazi in ponovitev

`npm.cmd --prefix backend test`: 46 uspešnih testov. `npm.cmd --prefix frontend test -- --run`: 41 uspešnih testov, vključno s petimi novimi primeri za evidence. Obe produkcijski gradnji uspešni.

Administratorski zaslon je vizualno pregledan na dejanski prazni bazi; napolnjeni seznami, povezave, aktivni in zaključeni pregledi so preverjeni z avtomatskimi testi.

Za ponovitev Auth preizkusa zaženi oba strežnika po README. Z nadzorovanim e-poštnim naslovom registriraj račun, pred potrditvijo poskusi prijavo, nato odpri prejeto povezavo. Preveri napačno geslo, ponovljeno registracijo, prijavo, osvežitev in odjavo. Za preverjanje osebja ciljano spremeni vlogo testnega profila po README in po testu obnovi prejšnjo vlogo. Gesel, potrditvenih povezav in žetonov ne zapisuj v poročila.

Po združitvi PR je vseh 31 kartic MVP v Done; Doing in To Do sta prazna. Razširitve F08–F12 ostajajo zunaj dogovorjenega MVP.
