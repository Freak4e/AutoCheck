# AutoCheck – uporabniške zgodbe (2. naloga)

## Izhodišča in predpostavke

Zgodbe razčlenjujejo izključno sedem MVP funkcionalnosti F01–F07 iz [obsega rešitve](02-funkcionalnosti-in-obseg.md). Upoštevajo [idejo](01-zasnova-resitve.md), [podatkovni model](03-podatkovni-model.md) in [arhitekturo](04-arhitektura-in-tehnoloski-sklad.md). F08–F12, servisiranje, registracija vozila, homologacija in carinski postopki niso del teh zgodb. Dokumentacija 1. naloge ostaja nespremenjena.

Manjše odločitve za opis uporabniškega vmesnika:

- Pregledi niso vnaprej dodeljeni pregledniku. Preglednik vidi razpored postaje; izvajalec postane šele s prevzemom rezervacije. Izraz »moj pregled« pomeni pregled, ki ga je sam prevzel.
- Po prijavi stranka pristane na svojih vozilih, preglednik na razporedu, administrator pa na pregledu evidenc. To je izbira navigacije, ne nova funkcionalnost.
- Shranjevanje ocen in opomb je izrecno z gumbom »Shrani postavko« oziroma »Shrani opombo«. Zaključek upošteva shranjene podatke; uporabnik je ob neshranjenih spremembah pozvan, naj jih najprej shrani.
- Potrditev e-pošte sledi nastavitvi Supabase Auth iz dokumenta 04. Če je vključena, je del registracijskega poteka. Ne dodajamo lastnih omejitev dolžine gesla, ki niso določene v zasnovi.
- Datumi v vmesniku so v časovnem pasu `Europe/Ljubljana`. Vzorčni podatki na wireframe-ih so izmišljeni in predstavljajo različne trenutke istega procesa.

Vsako zgodbo je mogoče preveriti z vnaprej pripravljenimi računi in podatki, brez izvedbe vseh predhodnih zgodb prek vmesnika. Funkcionalne povezave ne zahtevajo ene velike skupne zgodbe. [Wireframe-i](06-wireframes.md) prikazujejo razporeditev vsebine; ne predstavljajo implementacije.

## Pregled, ki preseže načrtovani termin

To je podrobnejša obravnava zamude znotraj F04, skladna z obstoječim pravilom ene pregledne postaje in nespremenjenih časov rezervacij iz dokumenta 02. Ne uvaja novih stanj, prestavljanja terminov ali avtomatske čakalne vrste.

- **30 minut je načrtovano trajanje termina, ne omejitev izvedbe.** Dejanski pregled lahko traja dlje; sistem ga po izteku časa ne zaključi, prekine ali označi z neuspešnim izidom. Ostane `IN_PROGRESS`, izvajalec pa ga lahko še naprej izpolnjuje.
- **Dokler obstaja `IN_PROGRESS`, je začetek vseh drugih pregledov blokiran.** Naslednja rezervacija ostane `BOOKED`, tudi če njen načrtovani začetek ali konec že mine. Preverjanje velja na strežniku za vse preglednike, tudi ob sočasnih zahtevah.
- **Načrtovani in dejanski časi so ločeni.** `AppointmentSlot.startsAt` in `endsAt` se zaradi zamude ne spreminjata. Dejanski začetek je `Inspection.startedAt`, dejanski zaključek pa `completedAt`. Prekoračitev načrtovanega termina obstaja, ko je pregled še `IN_PROGRESS` in je trenutni čas po `endsAt`; to ni nujno isto kot več kot 30 minut od dejanskega začetka.
- **Vmesnik po osvežitvi pojasni zamudo.** Preglednik pri aktivnem pregledu vidi »Pregled presega načrtovani konec termina«, pri naslednjem pa »Začetek ni mogoč: pregledno mesto je zasedeno«. Stranka pri lastnem `BOOKED`, katerega začetek je že minil, vidi »Termin se še ni začel; možna je zamuda«. Ne vidi podatkov druge stranke ali njenih ugotovitev. Zamuda je obvestilo, ne novo stanje.
- **Po veljavnem zaključku se pregledno mesto sprosti.** Preglednik lahko ročno prevzame prispelo vozilo s še vedno veljavno rezervacijo `BOOKED`, katere načrtovani začetek je že dosežen, tudi po načrtovanem koncu. Sistem ne začne naslednjega pregleda sam in ne določa avtomatskega vrstnega reda strank.
- **Izid je odvisen od postavk in napak, ne trajanja.** Daljši pregled mora izpolniti enake pogoje zaključka iz US-12. Ni samodejnih novih terminov, napovedi časa čakanja ali e-poštnih oziroma SMS obvestil.

Primer za preverjanje (obe vozili sta prispeli, drugi preglednik ne začne dodatnega pregleda):

| Čas | Pregled A: termin 10.00–10.30 | Rezervacija B: termin 10.30–11.00 |
| --- | --- | --- |
| 10.05 | Izvajalec ga prevzame; `IN_PROGRESS`, `startedAt = 10.05`. | Ostane `BOOKED`; začetek še ni dovoljen. |
| 10.40 | Še vedno `IN_PROGRESS`; pregled traja 35 minut in presega načrtovani konec. | Ostane `BOOKED`; začetek je blokiran zaradi zasedenega mesta. |
| 10.45 | Ob izpolnjenih pogojih izvajalec zaključi; `COMPLETED`, `completedAt = 10.45`. | Po osvežitvi je prevzem dovoljen; čas termina ostane 10.30–11.00. |
| 10.46 | Ostane `COMPLETED`. | Ob ročnem prevzemu preide v `IN_PROGRESS`, `startedAt = 10.46`; ob 11.00 se ne zaključi samodejno. |

Če A tudi ob 11.10 še ni zaključen, B ostane `BOOKED` brez novega termina. Ko se mesto sprosti, je B še vedno mogoče prevzeti. Zaprtje strani ali odjava izvajalca ne zaključita aktivnega pregleda; isti izvajalec ga po ponovni prijavi nadaljuje.

## US-01 – Ustvarjanje računa stranke

**Povezana funkcionalnost:** F01 – Dostop glede na vlogo.  
**Uporabniška vloga:** Stranka (pred registracijo obiskovalec).  
**Uporabniška zgodba:** Kot stranka želim ustvariti račun, da lahko naročim svoje vozilo na tehnični pregled.

**Kriteriji sprejema:**

1. Obrazec sprejme ime, e-pošto in geslo; brez obveznega podatka ali z neveljavno obliko e-pošte ne omogoči uspešne registracije in navede problematično polje.
2. Ob uspešni registraciji nastane račun v Supabase Auth; po prvi uspešni prijavi nastane pripadajoči profil z vnesenim imenom in vlogo `CUSTOMER`.
3. Ob vključeni potrditvi e-pošte uporabnik vidi navodilo za potrditev in do zaščitenih strani ne dostopa pred uspešno prijavo.
4. Ponoven poskus registracije iste e-pošte ne ustvari drugega računa; uporabnik dobi navodilo za nadaljevanje prijavnega postopka, skladno z odgovorom Supabase Auth.
5. Obrazec nima izbire vloge; posredovanje `ADMIN` ali `INSPECTOR` v zahtevku ne spremeni dodeljene vloge `CUSTOMER`.

## US-02 – Prijava in dostop glede na vlogo

**Povezana funkcionalnost:** F01 – Dostop glede na vlogo.  
**Uporabniška vloga:** Stranka, preglednik ali administrator.  
**Uporabniška zgodba:** Kot uporabnik želim po prijavi dostopati do nalog svoje vloge, da lahko izvajam dovoljena opravila s svojim računom.

**Kriteriji sprejema:**

1. Veljavna e-pošta in geslo omogočita prijavo; uporabnik vidi svojo vlogo in začetni zaslon, določen v predpostavkah. Ponovna prijava ne spremeni obstoječega profila ali njegove vloge.
2. Napačni prijavni podatki vrnejo obvestilo o neuspešni prijavi in ne odprejo zaščitenih podatkov.
3. Neprijavljen uporabnik ob odpiranju zaščitene strani dobi prijavni zaslon; neposredna zahteva brez veljavne prijave je zavrnjena z `401`.
4. Neposreden klic dejanja druge vloge je zavrnjen z `403`; zahteva za tuj nedostopen zapis z `404`. Skrivanje navigacije ne nadomesti preverjanja na strežniku.
5. Odjava odstrani prijavljeno sejo iz vmesnika in uporabnika vrne na prijavo; nadaljnji običajni dostop prek vmesnika zahteva ponovno prijavo.

## US-03 – Vnos lastnega vozila

**Povezana funkcionalnost:** F02 – Evidenca lastnih vozil.  
**Uporabniška vloga:** Stranka.  
**Uporabniška zgodba:** Kot stranka želim vnesti svoje vozilo, da ga lahko izberem pri rezervaciji pregleda.

**Kriteriji sprejema:**

1. Po vnosu registrske oznake, proizvajalca, modela, letnika in VIN nastane vozilo, ki se prikaže med vozili prijavljene stranke.
2. Prazno obvezno polje prepreči shranjevanje; letnik mora biti celo število med 1900 in trenutnim letom + 1.
3. VIN se shrani z velikimi črkami, ima natanko 17 znakov in vsebuje samo številke ter črke brez I, O in Q; neveljaven VIN se zavrne.
4. Registrska oznaka se normalizira z velikimi črkami brez presledkov in vezajev. Podvojen VIN ali normalizirana registrska oznaka ne ustvari novega vozila; odgovor ne razkrije lastnika obstoječega vozila.
5. Lastnika določi sistem iz prijavljene stranke; vnos drugega `ownerId` ne omogoči ustvarjanja vozila v tujem imenu.

## US-04 – Pregled in popravek podatkov lastnih vozil

**Povezana funkcionalnost:** F02 – Evidenca lastnih vozil.  
**Uporabniška vloga:** Stranka.  
**Uporabniška zgodba:** Kot stranka želim pregledati svoja vozila in pred prvo rezervacijo popraviti njihov vnos, da pregled naročim za vozilo s točnimi podatki.

**Kriteriji sprejema:**

1. Seznam in podrobnosti vsebujejo samo vozila prijavljene stranke; prazen seznam prikaže obvestilo in dejanje za vnos vozila.
2. Vozilu brez rezervacij je mogoče popraviti registrsko oznako, proizvajalca, model, letnik in VIN; po shranjevanju in ponovnem odpiranju so vidne nove vrednosti.
3. Popravek upošteva obvezna polja, letnik, obliko VIN in enoličnost iz US-03; zavrnjen popravek ohrani prej shranjene podatke.
4. Če ima vozilo katerokoli rezervacijo, tudi `COMPLETED`, je popravljanje onemogočeno z razlago. Neposreden poskus spremembe je zavrnjen, tudi če je rezervacija nastala po odprtju obrazca.
5. Stranka ne more prebrati ali spremeniti tujega vozila, prenesti lastništva ali izbrisati vozila; v MVP ni takšnih dejanj.

## US-05 – Objava prostega termina

**Povezana funkcionalnost:** F03 – Objava in rezervacija termina.  
**Uporabniška vloga:** Administrator.  
**Uporabniška zgodba:** Kot administrator želim objaviti prost termin, da stranke lahko izberejo razpoložljiv čas pregleda.

**Kriteriji sprejema:**

1. Ob izbiri prihodnjega datuma in ure sistem ustvari termin s trajanjem natanko 30 minut in ga prikaže med prostimi termini.
2. Manjkajoč ali neveljaven datum oziroma ura ter začetek v preteklosti ali v trenutnem času preprečijo objavo; prihodnost se preveri tudi ob shranjevanju.
3. Termin se ne sme prekrivati z nobenim obstoječim terminom, ne glede na zasedenost. Termin 10.30–11.00 je dovoljen ob obstoječem 10.00–10.30; termin 10.15–10.45 ni.
4. Dva sočasna poskusa objave istega ali prekrivajočega se termina ustvarita največ en termin; drugi vrne konflikt brez dodatnega zapisa.
5. Termine lahko objavi samo administrator. V MVP tudi administrator ne more urejati ali umakniti že ustvarjenega termina; to je F09 za kasneje.

## US-06 – Rezervacija prostega termina za lastno vozilo

**Povezana funkcionalnost:** F03 – Objava in rezervacija termina.  
**Uporabniška vloga:** Stranka.  
**Uporabniška zgodba:** Kot stranka želim rezervirati prost termin za svoje vozilo, da imam dogovorjen čas prihoda na pregled.

**Kriteriji sprejema:**

1. Izbirnik ponudi samo lastna vozila in proste prihodnje termine. Brez vozila ali prostih terminov prikaže razlog, rezervacije pa ne omogoči.
2. Potrditev izbranega vozila in termina ustvari eno rezervacijo `BOOKED`, povezano s prijavljeno stranko; prikažejo se vozilo, datum in čas, termin pa ni več prost.
3. Izpuščena izbira, tuje vozilo ali vozilo z rezervacijo `BOOKED` oziroma `IN_PROGRESS` preprečijo novo rezervacijo. Po zaključeni rezervaciji je za isto vozilo dovoljen nov običajen pregled.
4. Če termin med izbiro in potrditvijo zasede druga stranka ali njegov začetek ni več v prihodnosti, se zahteva zavrne; uporabnik dobi obvestilo in lahko izbere drug prost termin.
5. Sočasni rezervaciji istega termina ali istega vozila ustvarita največ eno novo odprto rezervacijo; ne nastanejo podvojeni ali delni zapisi.

## US-07 – Spremljanje lastnih rezervacij

**Povezana funkcionalnost:** F04 – Prevzem in potek pregleda.  
**Uporabniška vloga:** Stranka.  
**Uporabniška zgodba:** Kot stranka želim videti svoje odprte rezervacije, da vem, kdaj pripeljem vozilo in ali pregled že poteka.

**Kriteriji sprejema:**

1. Seznam pokaže lastne rezervacije v stanju `BOOKED` ali `IN_PROGRESS` z vozilom, datumom, začetkom in koncem termina ter stanjem.
2. Če odprtih rezervacij ni, uporabnik vidi obvestilo in povezavo do rezervacije novega termina.
3. Rezervacija `BOOKED` ostane vidna tudi po predvidenem začetku ali koncu, če je preglednik še ni prevzel. Po začetku termina vmesnik ob osvežitvi prikaže »Termin se še ni začel; možna je zamuda«, brez podatkov drugih strank. Zamuda rezervacije ne odpove, prestavi ali ustvari novega stanja.
4. Po osvežitvi uporabnik vidi stanje, ki ga je s prevzemom ali zaključkom spremenil preglednik; zaključen pregled je dostopen v zgodovini. Stranka med pregledom ne vidi še nedokončanih ugotovitev.
5. Stranka ne more odpreti tuje rezervacije, ročno spreminjati stanja, odpovedati rezervacije ali prestaviti termina; prestavitev F11 ni del MVP.

## US-08 – Pregled razporeda postaje

**Povezana funkcionalnost:** F04 – Prevzem in potek pregleda.  
**Uporabniška vloga:** Preglednik.  
**Uporabniška zgodba:** Kot preglednik želim videti razpored naročenih vozil, da lahko ob prihodu vozila izberem rezervacijo za prevzem.

**Kriteriji sprejema:**

1. Razpored vsebuje rezervacije postaje s terminom, registrsko oznako, proizvajalcem, modelom in stanjem; prazen razpored izpiše, da ni rezervacij.
2. Preglednik lahko prek rezervacije prebere podatke pripadajočega vozila, nima pa splošnega dostopa do zbirke uporabniških računov ali vseh vozil brez rezervacij.
3. Pri rezervaciji `BOOKED` se dejanje »Začni pregled« omogoči od začetka termina naprej, samo če na postaji ne poteka drug pregled. Ob prekoračitvi termina aktivni pregled ostane označen `IN_PROGRESS` z obvestilom o prekoračitvi; drugi začetki so onemogočeni z razlogom »Pregledno mesto je zasedeno«.
4. Pri lastnem `IN_PROGRESS` je na voljo »Nadaljuj pregled«. Pri pregledu drugega preglednika je vidno, da je prevzet, brez dostopa do njegovih ugotovitev ali urejanja.
5. Preglednik lahko odpre svoje zaključene preglede v bralnem načinu; ne more ustvarjati terminov ali spreminjati stanja rezervacije z neposrednim urejanjem vrstice.

## US-09 – Prevzem naročenega pregleda

**Povezana funkcionalnost:** F04 – Prevzem in potek pregleda.  
**Uporabniška vloga:** Preglednik.  
**Uporabniška zgodba:** Kot preglednik želim prevzeti rezervacijo prispelega vozila, da lahko začnem beležiti njegov pregled.

**Kriteriji sprejema:**

1. Prevzem rezervacije `BOOKED` od začetka termina naprej spremeni stanje v `IN_PROGRESS`, ustvari en `Inspection` z izvajalcem in časom začetka ter odpre zaslon za izvedbo.
2. Ob prevzemu se kopirajo aktivne postavke predloge z besedilom in vrstnim redom, začetno oceno `NOT_CHECKED` ter praznim končnim izidom in časom zaključka. Začetna predloga MVP ima sedem postavk.
3. Prevzem pred začetkom termina, prevzem rezervacije, ki ni `BOOKED`, ali prevzem ob drugem aktivnem pregledu se zavrne brez sprememb. Po dejanskem zaključku prejšnjega pregleda je zamujen `BOOKED` mogoče ročno prevzeti tudi po načrtovanem koncu njegovega termina; shrani se dejanski začetek, načrtovani termin ostane nespremenjen.
4. Sočasna prevzema iste ali različnih rezervacij ustvarita največ en aktiven pregled na postaji. Če prevzem ne uspe ali ni aktivnih postavk predloge, ne ostane delno ustvarjen pregled.
5. Začetek lahko izvede samo preglednik; izvajalec je prijavljeni preglednik in ga uporabnik ne more zamenjati z ID drugega uporabnika.

## US-10 – Ocenjevanje kontrolnega seznama

**Povezana funkcionalnost:** F05 – Izpolnjevanje kontrolnega seznama.  
**Uporabniška vloga:** Preglednik.  
**Uporabniška zgodba:** Kot preglednik želim oceniti predvidene postavke in zapisati opombe, da ostane razvidno, kaj sem pri vozilu preveril.

**Kriteriji sprejema:**

1. Lasten aktivni pregled prikazuje kopirane postavke za zavore, luči, pnevmatike, krmiljenje, vzmetenje, emisije in identifikacijo vozila v vrstnem redu predloge.
2. Preglednik shrani oceno `PASS`, `FAIL` ali `NOT_CHECKED` in neobvezno opombo posamezne postavke; po ponovnem odpiranju so shranjene vrednosti ohranjene.
3. Pred zaključkom lahko oceno popravi ali vrne na `NOT_CHECKED` ter shrani ali popravi splošno opombo pregleda. Začasna nepopolnost je dovoljena, zaključek pa sledi US-12.
4. Med izvajanjem ni mogoče dodajati, brisati ali preimenovati postavk pregleda; sprememba predloge kasneje ne spremeni kopiranih besedil tega pregleda.
5. Spremembe postavk in opomb so dovoljene samo izvajalcu lastnega `IN_PROGRESS`; tuja postavka v URL ali poskus spremembe zaključenega pregleda sta zavrnjena brez sprememb.

## US-11 – Beleženje in popravljanje napak

**Povezana funkcionalnost:** F06 – Evidentiranje napak po postavkah.  
**Uporabniška vloga:** Preglednik.  
**Uporabniška zgodba:** Kot preglednik želim pri postavki zabeležiti opis in resnost ugotovljenih napak, da stranka razume ugotovitve in sistem lahko določi izid.

**Kriteriji sprejema:**

1. Pri izbrani neuspešni postavki lastnega aktivnega pregleda preglednik shrani eno ali več napak; vsaka vsebuje opis in resnost `MINOR` ali `MAJOR` ter se prikaže ob tej postavki.
2. Prazen opis, opis samo s presledki, manjkajoča resnost ali druga vrednost resnosti se zavrnejo in ne ustvarijo napake.
3. Pred zaključkom lahko izvajalec popravi opis oziroma resnost ali odstrani napačno vneseno napako; sprememba je vidna po ponovnem odpiranju pregleda.
4. Po odstranitvi zadnje napake postavka `FAIL` potrebuje novo napako ali popravek ocene. Tudi `MINOR` zahteva `FAIL`; neskladje s `PASS` se prikaže in prepreči zaključek, ne da bi se ocena samodejno spreminjala.
5. Napaka mora pripadati postavki istega pregleda. Drug preglednik, stranka in administrator je ne morejo spreminjati; po zaključku je ne more spreminjati niti izvajalec.

## US-12 – Zaključek pregleda in določitev izida

**Povezana funkcionalnost:** F04 – Prevzem in potek pregleda; F07 – Izračun izida in zgodovina vozila.  
**Uporabniška vloga:** Preglednik.  
**Uporabniška zgodba:** Kot preglednik želim zaključiti v celoti izpolnjen pregled, da se ugotovitve in končni izid trajno shranijo.

**Kriteriji sprejema:**

1. Zaključek lahko potrdi samo izvajalec svojega `IN_PROGRESS`. Če ima zaslon neshranjene spremembe, jih mora pred zaključkom shraniti; strežnik vedno preveri dejansko shranjene podatke.
2. Vsaj ena postavka `NOT_CHECKED`, `FAIL` brez napake ali `PASS` z napako prepreči zaključek z razlago. Stanje ostane `IN_PROGRESS`, izid in čas zaključka ostaneta `NULL`, tudi ob obstoječi napaki `MAJOR`.
3. Po uspešni validaciji sistem določi `PASSED`, če so vse postavke `PASS` brez napak; `REINSPECTION_REQUIRED`, če obstajajo samo `MINOR`; oziroma `FAILED`, če obstaja vsaj ena `MAJOR`, tudi skupaj z `MINOR`. Število manjših napak ne spremeni pravila.
4. Izid, dejanski čas zaključka in prehod rezervacije v `COMPLETED` se shranijo skupaj ali pa se ne shrani nobena od teh sprememb. To velja tudi po izteku 30-minutnega termina; sam potek časa pregleda ne zaključi in ne sprosti mesta. Sočasna sprememba ugotovitev ne sme povzročiti izida, ki ni skladen s shranjenimi napakami.
5. Po zaključku so pregled, postavke in napake samo za branje; ponovni zaključek se zavrne. Noben izid ne odpre rezervacije ponovno, ne ustvari avtomatskega ponovnega termina in ne pomeni uradne registracije vozila.

## US-13 – Zgodovina pregledov lastnega vozila

**Povezana funkcionalnost:** F07 – Izračun izida in zgodovina vozila.  
**Uporabniška vloga:** Stranka.  
**Uporabniška zgodba:** Kot stranka želim pregledati zgodovino tehničnih pregledov svojega vozila, da lahko spremljam pretekle rezultate.

**Kriteriji sprejema:**

1. Stranka izbere eno od lastnih vozil in vidi njegove zaključene preglede z datumom ter končnim izidom, brez mešanja zapisov drugih vozil.
2. Pregledi `IN_PROGRESS` niso vključeni med zaključene rezultate; ko preglednik zaključi pregled, se ta po osvežitvi pojavi v zgodovini.
3. Za vozilo brez zaključenih pregledov se prikaže obvestilo »Vozilo še nima zaključenih pregledov«, brez izmišljenega rezultata.
4. Izbira pregleda odpre njegove podrobnosti iz US-14; stranka zgodovine ne more spreminjati ali brisati.
5. Zahteva za zgodovino tujega vozila, tudi z neposrednim ID, se zavrne brez razkritja pregledov.

## US-14 – Branje ugotovitev zaključenega pregleda

**Povezana funkcionalnost:** F07 – Izračun izida in zgodovina vozila.  
**Uporabniška vloga:** Stranka.  
**Uporabniška zgodba:** Kot stranka želim prebrati ugotovitve posameznega zaključenega pregleda, da razumem njegov izid in zapisane napake.

**Kriteriji sprejema:**

1. Podrobnosti lastnega zaključenega pregleda pokažejo vozilo, izvajalca, začetek, zaključek in končni izid; stanje rezervacije je pri vseh izidih `COMPLETED`.
2. Za vsako postavko so vidni kategorija, besedilo preverjanja, ocena, morebitna opomba ter vse pripadajoče napake z opisom in resnostjo.
3. Brez napak je prikazano obvestilo, da napake niso bile ugotovljene; prazna neobvezna opomba ni prikazana kot napaka ali manjkajoča obveznost.
4. Pri `REINSPECTION_REQUIRED` je razvidno, da nov termin ni samodejno rezerviran. Morebitno naročanje uporablja običajno rezervacijo iz US-06, brez posebnega procesa ponovnega pregleda.
5. Stranka nima dejanj za urejanje ali zaključevanje; tuji ali še aktivni pregled ni dostopen niti prek neposredne povezave.

## US-15 – Administratorski vpogled v evidence postaje

**Povezana funkcionalnost:** F02 – Evidenca lastnih vozil; F04 – Prevzem in potek pregleda; F07 – Izračun izida in zgodovina vozila.  
**Uporabniška vloga:** Administrator.  
**Uporabniška zgodba:** Kot administrator želim pregledati vozila, rezervacije in preglede postaje, da lahko spremljam naročila in izvedbo pregledov.

**Kriteriji sprejema:**

1. Administrator vidi sezname vseh vozil, rezervacij in pregledov postaje, tudi če pripadajo različnim strankam; prazen seznam ima jasno obvestilo.
2. Iz vozila oziroma rezervacije lahko odpre pripadajoče podatke in pregled, če ta obstaja. Pri `BOOKED` brez pregleda je prikazano »Pregled še ni začet«.
3. Aktiven pregled odpre v bralnem načinu s trenutnimi ocenami in brez končnega izida; zaključen pregled pokaže shranjene ugotovitve, napake in izid.
4. Administrator ne more popravljati vozil strank, prevzemati pregledov, ocenjevati postavk, spreminjati napak ali zaključevati pregledov; poskusi teh dejanj prek API se zavrnejo.
5. Zaslon nima upravljanja uporabnikov, urejanja predloge ali statistike F08, F10 in F12. Objavo terminov odpre kot ločeno že dogovorjeno dejanje US-05.

## Sledljivost MVP

Oznake WF se nanašajo na [opis in slike wireframov](06-wireframes.md). Zgodbe US-01–US-15 pokrijejo celoten MVP; dodatne funkcionalnosti niso uvedene.

| MVP funkcionalnost | Uporabniške zgodbe | Povezani wireframe-i |
| --- | --- | --- |
| F01 – Dostop glede na vlogo | US-01, US-02 | WF-05; navigacija glede na vlogo na WF-01–WF-08 |
| F02 – Evidenca lastnih vozil | US-03, US-04, US-15 | WF-06, WF-08 |
| F03 – Objava in rezervacija termina | US-05, US-06 | WF-07, WF-01 |
| F04 – Prevzem in potek pregleda | US-07, US-08, US-09, US-12, US-15 | WF-01, WF-02, WF-02b, WF-03, WF-08 |
| F05 – Izpolnjevanje kontrolnega seznama | US-10 | WF-03 |
| F06 – Evidentiranje napak po postavkah | US-11 | WF-03 |
| F07 – Izračun izida in zgodovina vozila | US-12, US-13, US-14, US-15 | WF-03, WF-04, WF-08 |
