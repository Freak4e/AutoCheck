# Preverjanje F01 – prijava in vloge

Obseg: **US-01 in US-02** iz [2. naloge](05-uporabniske-zgodbe.md). F02–F07 še niso implementirani. Začetne strani vlog preverjajo prijavo in pravice, ne pa delovanja evidenc vozil ali pregledov.

## Izvedena avtomatska preverjanja

- Backend: **12 testov** prek pravega Express HTTP vmesnika s Supertest ter začasne PostgreSQL baze PGlite. Izvede se dejanska `database/schema.sql` in parametrizirani SQL iz aplikacije. Preverjanje žetona Supabase je v teh testih nadzorovan nadomestek.
- Frontend: **12 testov** React vmesnika z Vitest in Testing Library. Preverijo obrazce, obnovo seje, vse tri začetne strani, odjavo in zavrnjen dostop. Supabase in odzivi Express so v testih nadzorovani nadomestki.
- TypeScript preverjanje in gradnja obeh aplikacij.
- GitHub Actions ob PR izvede namestitev iz lock datotek, teste in gradnjo ločeno za frontend in backend.

Ukazi so v [README](../README.md#preverjanje-in-gradnja). Avtomatski testi ne potrebujejo produkcijskih nastavitev ali skrivnosti.

| Kriterij | Avtomatsko preverjeno | Zunanji preizkus |
| --- | --- | --- |
| US-01.1 | Obvezno ime/e-pošta/geslo, presledki, napačna e-pošta, napake ob poljih; neveljaven obrazec ne kliče Auth. | Preveriti v brskalniku s pravim Auth. |
| US-01.2 | Klic signUp in profil preverjenega ID-ja, shranjen v SQL kot CUSTOMER. | Ustvarjanje dejanskega Auth računa in profila na Supabase še čaka. |
| US-01.3 | Odgovor brez seje pokaže navodilo za potrditev; neprijavljen uporabnik ostane na prijavi. | Dostava in odprtje potrditvene povezave še čakata. |
| US-01.4 | Sporočilo brez seje vključuje navodilo za obstoječ račun; geslo se odstrani iz obrazca. | Ponovitev iste e-pošte na Supabase še čaka. Enoličnost računa zagotavlja Auth. |
| US-01.5 | Registracijski zahtevek ne vsebuje vloge. API ignorira podtaknjena id in role; SQL dodeli CUSTOMER. | Preveriti tudi neposreden Auth zahtevek z metadata.role. |
| US-02.1 | Vse tri začetne strani, SQL vloga, obstoječe ime in vloga se ne prepišeta, sočasna priprava ne podvoji profila. | Prijava treh dejanskih računov še čaka. |
| US-02.2 | Napačni prijavni podatki pokažejo napako; ni zaščitenega zaslona. | Preveriti z dejanskim napačnim geslom. |
| US-02.3 | Zaščiten URL brez seje pokaže prijavo; manjkajoč/neveljaven žeton vrne 401. | Potek veljavnosti dejanskega žetona še čaka. |
| US-02.4 | Matrika treh vlog vrne 403 pri tujem prostoru, tuj/neobstoječ profil vrne enak 404; vloga se pri vsaki zahtevi bere iz SQL. | Dostop do tujih vozil/pregledov se preveri ob njihovi implementaciji. |
| US-02.5 | Odjava odstrani zaščiten prikaz in vrne prijavo; pozen odgovor stare zahteve ne obnovi zaščitenega zaslona. | Dejansko odstranjevanje in obnavljanje seje v brskalniku še čaka. |

Dodatno testi preverjajo SQL enoličnost, tuji ključ na Auth, dovoljene vloge, zaščito pred SQL injection, prepoved neposrednega dostopa vlog `anon`/`authenticated`, neveljaven JSON ter odziv ob izpadu storitve brez razkritja povezovalnih podatkov.

## Preostali preizkus na Supabase

Spremljamo ga v [Issue #35](https://github.com/Freak4e/AutoCheck/issues/35), ki ostaja **To Do**. Ob razvoju niso bile na voljo lokalne nastavitve Supabase; ne trdimo, da je bil ta preizkus opravljen.

1. Po README pripravi shemo, izključi Data API in izpolni obe `.env`. Zaženi backend in frontend.
2. Registriraj novo stranko z imenom, e-pošto in geslom, ki ustreza pravilom projekta. Ob vključeni potrditvi preveri navodilo in potrdi prejeto povezavo. Pred potrditvijo preveri zavrnjeno prijavo. Preizkusi tudi način brez potrditve, če ga bo projekt uporabljal.
3. Po prijavi preveri ime, vlogo Stranka in stran Moja vozila. V bazi mora biti en profil s pravilnim Auth UUID-jem in vlogo CUSTOMER. Zapri in ponovno odpri stran; seja naj se obnovi.
4. Ponovi registracijo iste e-pošte. Preveri navodilo za prijavo in da ni drugega Auth računa oziroma profila. Supabase lahko vrne prikrit odgovor zaradi preprečevanja razkrivanja računov.
5. Poskusi prijavo z napačnim geslom. Preveri sporočilo in odsotnost zaščitenega prikaza.
6. V Supabase pripravi preglednika in administratorja po README. Vsakega prijavi dvakrat; preveri pripadajoči začetni zaslon in nespremenjeno vlogo.
7. V brskalnikovem Network pogledu preveri `Authorization: Bearer …` za lastni API. Ne objavljaj žetona. Brez glave mora `GET /api/auth/me` vrniti 401, strankin klic `/api/workspace/admin` pa 403. Strankin klic `/api/auth/profiles/TUJI_UUID` mora vrniti 404.
8. Pri `POST /api/auth/profile` podtakni drugo vlogo in ID. Ustvari se oziroma vrne le lasten profil, brez povišanja pravic. Pri ponovitvi se ime in vloga ne spremenita.
9. Odjavi se. Osvežitev in vrnitev na zaščiten URL morata prikazati prijavo. Odjava je lokalna za trenutni brskalnik. Že izdani dostopni žetoni sledijo veljavnosti Supabase; ta funkcionalnost ne obljublja njihove takojšnje globalne razveljavitve.
10. Rezultate zabeleži v #35 brez gesel ali žetonov. Šele po uspešnem preizkusu nalogo zapri in premakni v Done.

## Viri implementacije

Uporabljeni so Supabase [signUp](https://supabase.com/docs/reference/javascript/auth-signup), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser) in [pravila odjave](https://supabase.com/docs/guides/auth/signout). TLS je nastavljen po [navodilih node-postgres](https://node-postgres.com/features/ssl); parametri SSL v povezovalnem nizu ne smejo prepisati preverjanja certifikata.
