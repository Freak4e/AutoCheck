# Preverjanje vozil in rezervacij (F02/F03)

Implementirani sta US-03/US-04 (lastna vozila) in US-05/US-06 (objava in rezervacija terminov). F02 vključuje tudi bralni dostop administratorja do vozil; celotna US-15 ostaja odprta zaradi rezervacij in pregledov.

## Avtomatski testi

Običajni `npm test` ima skupaj **44 testov**: 25 backend in 19 frontend. Novo preverjanje obsega:

| Kriteriji | Preverjanje |
| --- | --- |
| US-03.1–5 | Lastnik iz preverjenega uporabnika; normalizacija oznake in VIN; obvezna polja, celoštevilski letnik, 17 znakov brez I/O/Q; enoličnost brez razkritja lastnika; seznam lastnih vozil. |
| US-04.1–5 | Branje in popravek samo lastnega vozila; zavrnjen popravek ne spremeni podatkov; vsaka rezervacija, tudi COMPLETED, zaklene vozilo; prenos lastništva se ignorira, brisanje ni ponujeno. Administrator samo bere, preglednik nima splošnega dostopa do vozil. |
| US-05.1–5 | Samo administrator objavi prihodnji 30-minutni termin; neveljavni datumi in preteklost se zavrnejo; prekrivanje in isti začetek vrneta 409, stik na meji je dovoljen; nobene poti za popravek/umik. |
| US-06.1–5 | Samo lastna vozila in prosti prihodnji termini; manjkajoče izbire onemogočijo potrditev; BOOKED in customerId določi API; tuje vozilo, zaseden/pretekel termin in odprta rezervacija vozila se zavrnejo; po COMPLETED je nova rezervacija dovoljena. |
| Vmesnik | Izpolnjevanje urejanja, zaklenjeno vozilo, prazni seznami, potrditev rezervacije, prikaz konflikta in osvežitev ponudbe; admin objavi termin, vozila samo bere. |
| Časovni pas | Vnos vedno pomeni Europe/Ljubljana, ne časovnega pasu brskalnika. Neobstoječe in dvoumne ure ob menjavi ure se zavrnejo. |

Testi PostgreSQL/PGlite izvajajo isto shemo in SQL kot aplikacija. RLS in odvzem pravic preprečita neposredno branje novih tabel vlogama anon/authenticated.

## Izvedeni preizkus na povezani Supabase bazi

Ukaz `npm --prefix backend run test:live` je 5. 11. 2026 uspešno preveril dejanske sočasne PostgreSQL povezave in transakcije:

1. Dve prekrivajoči se objavi: ena 201, druga 409.
2. Dve rezervaciji istega termina za različni vozili: ena 201, druga 409.
3. Dve rezervaciji istega vozila za različna termina: ena 201, druga 409.
4. Sočasna rezervacija in popravek vozila: rezervacija uspe, popravek uspe samo, če zaklene vozilo pred rezervacijo. Vsak poznejši popravek vrne 409.
5. Po zavrnjenih zahtevah ostanejo natanko tri pričakovane rezervacije in brez delnih zapisov; tuje vozilo vrne 404.

Preizkus uporablja začasne UUID-zapise. Iz auth.users potrebuje samo FK-zapise brez e-pošte, gesla in uporabne prijave; preverjanje žetona je nadzorovano. Po preizkusu so bili ustvarjeni zapisi odstranjeni. TLS preveri zaupanja vredni CA in gostitelja povezave; preverjanje certifikata ni izklopljeno.

## Lokalni preizkus brskalnika

V dejanskem Edge brskalniku sta bila preverjena prijavni zaslon in registracijska validacija na namizni ter mobilni širini brez vodoravnega prelivanja. Frontend in backend se zaženeta z ukazoma iz README; health vrne 200, nezaščitena zahteva do vozil brez prijave pa 401.

Za celoten potek z dejanskimi računi ostaja ročni korak: registracija in potrditvena e-pošta iz #35, priprava računa ADMIN po README, objava termina ter rezervacija v strankinem brskalniku. Preverjanje dejanskih računov ni nadomeščeno s testnimi žetoni.

## Priprava sheme

Na novi bazi po vrsti izvedemo `database/schema.sql` in `database/changes/01-vehicles-slots-appointments.sql`. Na že pripravljeni F01 bazi izvedemo samo drugo datoteko. Obe sta že izvedeni v povezanem razvojnem projektu. Tabele pregledov in kontrolnega seznama bodo dodane pri F04/F05.
