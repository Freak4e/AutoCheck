# 0005 – Priprava baze s shranjenimi SQL datotekami

**Status:** Sprejeto

## Kontekst in problem

Shema osmih tabel in sedem začetnih postavk morata biti ponovljivo pripravljena. [Podatkovni model](../03-podatkovni-model.md#preprosta-priprava-baze) in [arhitektura](../04-arhitektura-in-tehnoloski-sklad.md#priprava-baze-in-spremembe-sheme) določata SQL Editor ter shranjene SQL datoteke. Aplikacija še ni izdelana, zato te datoteke trenutno še ne obstajajo.

## Obravnavane možnosti

- **Verzionirane SQL datoteke, ročno izvedene v Supabase SQL Editorju:** malo nastavitev in viden vrstni red sprememb; izvedbo je treba ročno spremljati.
- **Orodje za avtomatske migracije:** spremlja izvedene spremembe in pomaga pri več okoljih, vendar doda nastavitev ter proces, ki za trenutni mali projekt ni predviden.
- **Spreminjanje baze samo v nadzorni plošči brez shranjenih skript:** hitro za enkratno spremembo, a ne omogoča zanesljive ponovitve in pregleda razlik v Git.

## Odločitev

Izbrana možnost so **shranjene SQL datoteke z ročno izvedbo v SQL Editorju**. Ob implementaciji bo `database/schema.sql` pripravil začetno shemo in postavke. Poznejše spremembe bodo zaporedno oštevilčene v `database/changes/`, njihov vrstni red in izvedba pa zabeležena v README. Začetna računa osebja se pripravita ločeno.

To ohrani ponovljiv zapis ob najmanjšem potrebnem obsegu orodij za MVP. Poseben sistem migracij ni utemeljen v sedanji zasnovi; shranjevanje samih SQL sprememb pa je potrebno tudi ob gostovani bazi.

### Posledice

- Pozitivno: shemo in spremembe je mogoče pregledati v PR ter ponovno pripraviti brez dodatnega CLI ali migracijskega ogrodja.
- Pozitivno: manj nastavitev in odvisnosti pomeni manj začetnega dela za študijski projekt.
- Negativno: izvajalec mora preveriti ciljni projekt in vrstni red ter zabeležiti izvedbo; ni samodejne evidence migracij.
- Negativno: začetne sheme ne smemo ponovno izvesti čez obstoječe podatke. Pri več okoljih ali pogostejših spremembah bo treba odločitev ponovno presoditi z novim ADR.
