# 0006 – Kopije postavk in nespremenljivi zaključeni pregledi

**Status:** Sprejeto

## Kontekst in problem

Stranka mora v zgodovini videti vsebino, ki jo je preglednik dejansko ocenil. [Podatkovni model](../03-podatkovni-model.md) loči predlogo od ocenjenih postavk, [obseg](../02-funkcionalnosti-in-obseg.md#pravila-ocenjevanja-in-zaključka) pa prepoveduje spreminjanje zaključenih pregledov. Kasnejša nadgradnja F10 omogoča urejanje predloge in ne sme spremeniti zgodovine.

## Obravnavane možnosti

- **Kopiranje besedil in vrstnega reda ob začetku, nato zaklep zaključenih zapisov:** preprost prikaz izvirnih ugotovitev z nekaj podvajanja podatkov.
- **Samo povezava na trenutno predlogo:** manj podvajanja, vendar poznejša sprememba predloge spremeni prikaz starega pregleda in zato ne izpolni zahteve.
- **Verzioniranje predlog in vseh sprememb pregledov:** omogoči podrobnejšo zgodovino revizij, a doda model in logiko popravkov, ki nista v MVP.

## Odločitev

Izbrana možnost je **kopiranje aktivnih postavk predloge ob začetku in nespremenljivost zaključene vsebine**. `InspectionItem` shrani kategorijo, besedilo in vrstni red ter povezavo na izvorno postavko. Po zaključku pregleda so pregled, postavke in napake samo za branje. Podatke vozila je mogoče popraviti samo pred prvo rezervacijo, s čimer tudi prikaz vozila v zgodovini ostane stabilen.

Tak zapis neposredno izpolni potrebo po zgodovini in pripravi na F10 brez sistema revizij. Zaključek in urejanje se usklajujeta s transakcijami iz [ADR-0004](0004-izbira-sql-in-transakcij.md); nov običajen pregled je nov zapis, ne sprememba preteklega izida.

### Posledice

- Pozitivno: prihodnja sprememba predloge ne spremeni preteklih ugotovitev; branje zgodovine ne zahteva sestavljanja več revizij.
- Pozitivno: omejen model zmanjša čas izvedbe in vzdrževanja ter ohrani jasen pomen zaključenega pregleda.
- Negativno: besedila postavk se podvajajo pri vsakem pregledu, zato porabijo več prostora kot samo reference.
- Negativno: MVP ne omogoča popravkov napak v zaključenem zapisu ali podatkov vozila po prvi rezervaciji. Morebitni poznejši postopek popravkov zahteva novo zasnovo in ADR.
