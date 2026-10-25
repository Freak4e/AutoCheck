# 0002 – En Express REST API za poslovna pravila in pravice

**Status:** Sprejeto

## Kontekst in problem

Rezervacija, prevzem in zaključek pregleda spreminjajo povezane zapise. [Pravila MVP](../02-funkcionalnosti-in-obseg.md) zahtevajo preverjanje vloge, lastništva, izvajalca in stanja; skrivanje gumbov ni zadostno. [Arhitektura](../04-arhitektura-in-tehnoloski-sklad.md) že določa majhen Node.js/Express backend v TypeScriptu.

## Obravnavane možnosti

- **En Express REST API:** pravice in poslovni potek so zbrani v enem procesu; vzdrževati in zagnati je treba lasten backend.
- **Neposreden Supabase Data API z RLS in podatkovnimi funkcijami:** manj lastnega HTTP strežnika, vendar bi bile pravice in večstopenjska pravila razdeljena med odjemalca, politike in funkcije v bazi.
- **Ločene storitve za rezervacije in preglede:** omogočajo ločeno izvajanje, a zahtevajo usklajevanje podatkov in več nastavitev; ena majhna postaja tega ne potrebuje.

## Odločitev

Izbrana možnost je **en Node.js/Express REST API v TypeScriptu**. Za ta MVP je preprosteje na enem mestu preveriti uporabnika in v eni podatkovni transakciji izvesti povezane spremembe. Skupni jezik zmanjša prehajanje med različnimi aplikacijskimi skladi; ne uvajamo mikrostoritev ali dodatnih arhitekturnih plasti.

Frontend za prijavo uporablja Supabase Auth, poslovne podatke pa pridobi prek `/api`. Backend preveri žeton z `supabase.auth.getUser(token)`, vlogo prebere iz `profiles` in preveri dostop do konkretnega zapisa. **Supabase Data API bo izključen**, da poslovnih preverjanj ne bo mogoče obiti po drugi podatkovni poti; Auth ostane omogočen.

### Posledice

- Pozitivno: rezervacije, izračun izida in dostop imajo eno mesto uveljavljanja pravil.
- Pozitivno: odjemalec ne določa končnega izida ali poljubnih prehodov stanj; enak REST API podpira vse tri vloge.
- Negativno: backend je dodaten proces, ki ga je treba razviti, zagnati in vzdrževati; Supabase poslovnih pravil ne izdela namesto nas.
- Negativno: ob izključenem Data API je pravilnost strežniške avtorizacije ključna; vsako pot in dostop do tujih zapisov bo treba preveriti.
