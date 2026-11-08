# Preverjanje US-07 – lastne odprte rezervacije

8. 11. 2026; Issues #17 in #18. Sprememba ne potrebuje nove SQL migracije.

GET /api/appointments in GET /api/appointments/:id za stranko vrneta samo njene BOOKED/IN_PROGRESS rezervacije. Lastništvo se preverja na rezervaciji in vozilu. Odgovor vsebuje vozilo, termin, stanje in strežniško izračunan indikator zamude; ne vsebuje ugotovitev pregleda. Tuji, neobstoječi in zaključeni zapisi vrnejo 404.

## Kriteriji sprejema

- Seznam vsebuje vozilo, datum, začetek/konec in stanje. Pretekli BOOKED ostane viden ter po osvežitvi pokaže »Termin se še ni začel; možna je zamuda«.
- Prazni seznam ponudi povezavo do obrazca za nov termin.
- Osvežitev prikaže IN_PROGRESS ali odstrani zaključen pregled; besedilo usmeri v zgodovino vozila. Uspešna rezervacija samodejno osveži seznam.
- Stranka ne more spreminjati stanja, odpovedati ali prestavljati rezervacije. Zaščiten je tudi neposreden dostop do nedokončanih ugotovitev.
- Napaka nalaganja omogoči ponovitev. Zastarel odgovor prejšnje seje se prezre.

## Avtomatsko preverjanje

`npm.cmd --prefix backend test`: 46 testov, vključno z lastništvom, zamudo, prehodom stanj, obliko odgovora brez ugotovitev in zavrnitvijo sprememb.

`npm.cmd --prefix frontend test -- --run`: 36 testov, vključno s prikazom zamude, osvežitvijo, praznim seznamom, napako in zastarelim odgovorom. Obstoječi test rezervacije še naprej preverja potrditev in osvežitev razpoložljivosti.

Gradnji obeh delov uspešni. SQL testi uporabljajo PGlite in nadzorovan Auth. Dejanska registracija s potrditvijo e-pošte ostaja #35, administratorski vmesnik #34; obe nalogi sta v Doing za večerni PR.
