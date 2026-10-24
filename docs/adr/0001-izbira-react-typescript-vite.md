# 0001 – React, TypeScript in Vite za uporabniški vmesnik

**Status:** Sprejeto

## Kontekst in problem

AutoCheck potrebuje obrazce in sezname za tri vloge ter stran posameznega pregleda. [Zasnova](../01-zasnova-resitve.md) ne zahteva naprednega koledarja; [arhitektura](../04-arhitektura-in-tehnoloski-sklad.md#tehnologije-in-utemeljitev-izbire) določa React, TypeScript, Vite in navaden CSS. Vmesnik mora ostati izvedljiv v obsegu študijskega MVP.

## Obravnavane možnosti

- **React, TypeScript, Vite in navaden CSS:** komponente za ponavljajoče se obrazce in sezname, tipizacija ter razvojni strežnik; potrebno je znanje Reacta in konfiguracije gradnje.
- **HTML, CSS in JavaScript brez ogrodja:** manj odvisnosti in začetne nastavitve, a več ročnega usklajevanja stanja obrazcev, prijavljene seje in več zaslonov.
- **Vue in TypeScript z Vite:** primerljiva komponentna rešitev; obstoječa zasnova ji ne daje prednosti pred že izbranim Reactom, menjava pa zahteva prilagoditev načrta vmesnika.

## Odločitev

Izbrana možnost je **React s TypeScriptom, Vite in navadnim CSS**. Komponente omogočajo ponovno uporabo obrazcev in prikazov podatkov, TypeScript pa ohrani isti jezik na obeh delih aplikacije. Vite podpira načrtovani lokalni razvoj. Za dogovorjene zaslone zadostuje navaden CSS, zato ni potrebe po dodatnem ogrodju za oblikovanje.

Izbira sledi že sprejeti zasnovi; ni utemeljena z nedokazano trditvijo, da razvijalec React pozna bolje od alternativ. Dodajanje drugega ogrodja za MVP ne prinese dokumentirane koristi, poveča pa obseg nastavitev in učenja.

### Posledice

- Pozitivno: sorodni zasloni uporabljajo skupne komponente, tipi pomagajo pri usklajevanju podatkov z API.
- Pozitivno: navaden CSS in en jezik za aplikacijska dela omejita dodatne odvisnosti ter olajšata vzdrževanje majhnega projekta.
- Negativno: potrebna sta gradnja frontenda in poznavanje Reactovega stanja; TypeScript ne nadomesti preverjanja vhodnih podatkov na strežniku.
- Negativno: slog in osnovne elemente vmesnika je treba pripraviti samostojno, saj ni izbrane knjižnice oblikovanih komponent.
