# AutoCheck – zasnova rešitve

## Namen in problem

**AutoCheck** je spletna aplikacija za naročanje in evidentiranje tehničnih pregledov vozil na eni manjši postaji. Stranki omogoča rezervacijo termina za lastno vozilo, pregledniku pa strukturirano beleženje pregleda. Administrator skrbi za razpoložljive termine in ima vpogled v delovanje postaje.

Rešitev naslavlja nepovezanost podatkov, ki bi jih postaja sicer vodila v ločenem koledarju, preglednicah in papirnih zapisnikih: katero vozilo je naročeno, kdo ga pregleduje, kaj je bilo preverjeno in kakšen je bil izid. Podatke poveže v enoten potek in ohrani zgodovino pregledov vozila.

Projekt je učna simulacija. Ne predstavlja uradnega sistema za tehnične preglede, ne potrjuje tehnične brezhibnosti vozila in ne izdaja uradnih dokumentov. Pravila izidov so poenostavljena projektna pravila.

V dejanskem postopku je tehnična brezhibnost eden od pogojev za registracijo; potrebni so tudi urejeno obvezno zavarovanje, ustrezne dajatve in zahtevana dokazila. Uspešen tehnični pregled zato še ne pomeni opravljene registracije. [Pogoji registracije vozila – eUprava](https://e-uprava.gov.si/si/podrocja/promet/vozniki-in-vozila/registracija-vozila.html). V AutoCheck izid `PASSED` zaključi samo učni pregled in ne ustvari uradne registracije vozila. Tudi vnos vozila v aplikacijo ni njegova uradna registracija.

## Ciljni uporabniki

- **Stranka:** lastnik vozila, ki želi izbrati prost termin, preveriti prihajajočo rezervacijo in po pregledu prebrati ugotovitve za svoje vozilo.
- **Preglednik:** zaposleni na postaji, ki ob prihodu vozila prevzame naročeni pregled, preveri postavke kontrolnega seznama ter zabeleži napake.
- **Administrator:** odgovorna oseba postaje, ki pripravi razpoložljive termine in spremlja rezervacije ter rezultate. Kasneje bo prek aplikacije upravljala tudi uporabnike in predlogo kontrolnega seznama.

## Delovanje na konkretnem primeru

1. Administrator objavi proste 30-minutne termine. Postaja ima v zasnovi eno pregledno mesto, zato se termini ne prekrivajo.
2. Stranka se registrira, vnese svoje vozilo in zanj izbere prost termin. Rezervacija dobi stanje `BOOKED`; istega termina druga stranka ne more rezervirati.
3. Preglednik ob prihodu vozila začne rezervirani pregled. Rezervacija preide v `IN_PROGRESS`, sistem pa ustvari pregled in vanj kopira predvidene postavke kontrolnega seznama.
4. Preglednik oceni zavore, luči, pnevmatike, krmiljenje, vzmetenje, emisije in identifikacijo vozila. Ob neuspešni postavki zabeleži opis napake in resnost `MINOR` ali `MAJOR`.
5. Ko so ocenjene vse postavke in so podatki skladni, preglednik potrdi zaključek. Sistem izračuna izid: brez napak `PASSED`, samo z napakami `MINOR` izid `REINSPECTION_REQUIRED`, ob vsaj eni napaki `MAJOR` pa `FAILED`. Shrani čas zaključka in rezervacijo v vseh treh primerih označi kot `COMPLETED`.
6. Stranka v zgodovini svojega vozila vidi zaključen pregled, ocene postavk, napake in izid. Zaključenega pregleda ni več mogoče spreminjati.

## Meje prve različice

MVP vključuje eno postajo, eno pregledno mesto, tri uporabniške vloge, ročno ustvarjene termine in en kratek kontrolni seznam. Omogoča celoten potek od rezervacije do shranjenega rezultata brez povezovanja z uradnimi evidencami ali merilnimi napravami. Supabase zagotavlja gostovanje baze in prijavo uporabnikov. Uporabniški vmesnik sestavljajo obrazci, seznami in stran posameznega pregleda; napreden koledar ni potreben.

Zasnova in vsi ukazi v dokumentaciji opisujejo **načrtovano implementacijo**. V tej fazi nastaja samo dokumentacija, aplikacija še ni izdelana.

## Ostala dokumentacija

- [Funkcionalnosti, vloge in obseg](02-funkcionalnosti-in-obseg.md)
- [Podatkovni model in pravila podatkov](03-podatkovni-model.md)
- [Arhitektura, tehnologije, API in lokalni zagon](04-arhitektura-in-tehnoloski-sklad.md)
- [Uporabniške zgodbe in kriteriji sprejema](05-uporabniske-zgodbe.md)
- [Wireframe-i in povezave med zasloni](06-wireframes.md)
- [Arhitekturne odločitve in njihove utemeljitve](adr/README.md)
