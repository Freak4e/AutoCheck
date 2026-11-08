# Preverjanje F01 – prijava in vloge

Posodobljeno 8. 11. 2026: Issue #35 je preverjen na dejanskem Supabase projektu. Registracija, potrditev e-pošte, ponovna registracija, prijava vseh treh vlog, obnova seje, matrika pravic in odjava so uspešni.

Celotni rezultati, metoda preverjanja ter navodila za ponovitev so v [zaključnem poročilu MVP](13-preverjanje-zakljucka-mvp.md). Za vse tri vloge je uporabljen isti testni račun z začasno spremembo vloge; na koncu je obnovljena vloga CUSTOMER.

Avtomatski testi v repozitoriju dopolnjujejo dejanski preizkus: preverjajo obvezna polja obrazca, napake, nadzor dostopa, varno pripravo profila in delo s sejo. Celotni MVP ima 46 backend in 41 frontend testov; ukazi so v README. Gesel in žetonov ni v poročilih ali repozitoriju.
