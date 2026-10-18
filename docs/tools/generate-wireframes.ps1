param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\images'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$null = New-Item -ItemType Directory -Path $OutputDirectory -Force
$script:W = 1440
$script:H = 1200

function Escape-Xml([string]$Value) { [System.Security.SecurityElement]::Escape($Value) }
function Box($X, $Y, $Width, $Height, $Fill = '#ffffff', $Stroke = '#b5b5b5') {
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($Fill))
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($Stroke), 1)
    $script:G.FillRectangle($brush, [single]$X, [single]$Y, [single]$Width, [single]$Height)
    $script:G.DrawRectangle($pen, [single]$X, [single]$Y, [single]$Width, [single]$Height)
    $brush.Dispose(); $pen.Dispose()
    [void]$script:Svg.AppendLine("<rect x='$X' y='$Y' width='$Width' height='$Height' fill='$Fill' stroke='$Stroke'/>")
}
function Label($X, $Y, [string]$Text, $Width = 1000, $Size = 20, [bool]$Bold = $false, $Color = '#222222') {
    $style = [System.Drawing.FontStyle]::Regular
    if ($Bold) { $style = [System.Drawing.FontStyle]::Bold }
    $font = New-Object System.Drawing.Font('Arial', [single]$Size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($Color))
    $format = [System.Drawing.StringFormat]::GenericTypographic.Clone()
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
    $measure = $script:G.MeasureString($Text, $font, 10000, $format)
    if ($measure.Width -gt $Width -or $X + $measure.Width -gt $script:W -or $Y + $measure.Height -gt $script:H) {
        throw "Text exceeds bounds in $script:FileName : $Text ($($measure.Width) > $Width)"
    }
    $script:G.DrawString($Text, $font, $brush, [single]$X, [single]$Y, $format)
    $weight = 'normal'; if ($Bold) { $weight = 'bold' }
    $baseline = $Y + $Size
    [void]$script:Svg.AppendLine("<text x='$X' y='$baseline' font-family='Arial, sans-serif' font-size='$Size' font-weight='$weight' fill='$Color'>$(Escape-Xml $Text)</text>")
    $font.Dispose(); $brush.Dispose(); $format.Dispose()
}
function Button($X, $Y, $Width, [string]$Text, [bool]$Disabled = $false) {
    $fill = '#ffffff'; $color = '#222222'
    if ($Disabled) { $fill = '#eeeeee'; $color = '#777777' }
    Box $X $Y $Width 44 $fill '#555555'
    Label ($X + 14) ($Y + 11) $Text ($Width - 28) 18 $false $color
}
function Field($X, $Y, $Width, [string]$Title, [string]$Value, [bool]$Disabled = $false) {
    Label $X $Y $Title $Width 18 $true
    $fill = '#ffffff'; if ($Disabled) { $fill = '#eeeeee' }
    Box $X ($Y + 30) $Width 46 $fill
    Label ($X + 12) ($Y + 43) $Value ($Width - 24) 18
}
function Note($X, $Y, $Width, [string[]]$Lines) {
    Box $X $Y $Width (22 + 27 * $Lines.Count) '#f1f1f1'
    for ($i = 0; $i -lt $Lines.Count; $i++) { Label ($X + 14) ($Y + 11 + $i * 27) $Lines[$i] ($Width - 28) 18 }
}
function Table($X, $Y, [int[]]$Widths, [string[]]$Headers, $Rows) {
    if ($Rows.Count -gt 0 -and $Rows[0] -is [string]) { $Rows = ,$Rows }
    foreach ($row in $Rows) { if ($row.Count -ne $Widths.Count) { throw "Invalid table row in $script:FileName" } }
    $total = ($Widths | Measure-Object -Sum).Sum
    Box $X $Y $total 44 '#e8e8e8'
    $cursor = $X
    for ($c = 0; $c -lt $Widths.Count; $c++) { Label ($cursor + 12) ($Y + 12) $Headers[$c] ($Widths[$c] - 24) 17 $true; $cursor += $Widths[$c] }
    for ($r = 0; $r -lt $Rows.Count; $r++) {
        $rowY = $Y + 44 + 54 * $r
        Box $X $rowY $total 54
        $cursor = $X
        for ($c = 0; $c -lt $Widths.Count; $c++) { Label ($cursor + 12) ($rowY + 17) ([string]$Rows[$r][$c]) ($Widths[$c] - 24) 17; $cursor += $Widths[$c] }
    }
}
function Start-Frame([string]$FileName, [string]$Id, [string]$Title, [string]$Role, [string]$Active, [string]$Subtitle) {
    $script:FileName = $FileName
    $script:Bitmap = New-Object System.Drawing.Bitmap($script:W, $script:H)
    $script:G = [System.Drawing.Graphics]::FromImage($script:Bitmap)
    $script:G.Clear([System.Drawing.Color]::White)
    $script:G.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $script:G.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $script:Svg = New-Object System.Text.StringBuilder
    [void]$script:Svg.AppendLine("<svg xmlns='http://www.w3.org/2000/svg' width='$script:W' height='$script:H' viewBox='0 0 $script:W $script:H' role='img'>")
    [void]$script:Svg.AppendLine("<title>$(Escape-Xml "$Id – $Title")</title><rect width='100%' height='100%' fill='white'/>")
    Box 0 0 1440 80 '#eeeeee'
    Label 28 23 'AutoCheck' 210 28 $true
    Label 265 29 $Role 760 20
    if ($Role -ne 'Obiskovalec') { Button 1250 18 150 'Odjava' }
    Box 0 80 225 1065 '#f6f6f6'
    $nav = @('Prijava / račun')
    if ($Role -eq 'Stranka') { $nav = @('Moja vozila', 'Termini', 'Zgodovina') }
    if ($Role -eq 'Preglednik') { $nav = @('Razpored', 'Moj pregled') }
    if ($Role -eq 'Administrator') { $nav = @('Evidence', 'Termini') }
    for ($i = 0; $i -lt $nav.Count; $i++) {
        $y = 130 + $i * 64
        if ($nav[$i] -eq $Active) { Box 14 $y 197 46 '#dedede' '#dedede' }
        Label 28 ($y + 13) $nav[$i] 174 18 ($nav[$i] -eq $Active)
    }
    Label 260 110 "$Id – $Title" 1130 30 $true
    Label 260 160 $Subtitle 1130 18 $false '#555555'
    Label 28 1164 "$Id | Nizkopodroben wireframe | Izmišljeni primeri | Časovni pas: Europe/Ljubljana" 1360 17 $false '#555555'
}
function Save-Frame {
    [void]$script:Svg.AppendLine('</svg>')
    $script:Bitmap.Save((Join-Path $OutputDirectory ($script:FileName + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllText((Join-Path $OutputDirectory ($script:FileName + '.svg')), $script:Svg.ToString(), (New-Object System.Text.UTF8Encoding($false)))
    $script:G.Dispose(); $script:Bitmap.Dispose()
    Write-Output ('Created ' + $script:FileName + ' (PNG + SVG)')
}

Start-Frame 'wf-01-rezervacija-termina' 'WF-01' 'Rezervacija termina' 'Stranka' 'Termini' 'Izberi svoje vozilo in prost prihodnji termin. Primer pred potrditvijo rezervacije.'
Box 260 210 1130 550
Field 285 235 640 'Vozilo' 'LJAC101 · Renault Clio · 2018     [izberi]'
Button 970 265 230 'Dodaj vozilo'
Label 285 345 'Prosti termini · 22. 10. 2026' 900 23 $true
Table 285 390 @(130,230,230,490) @('Izbira','Začetek','Konec','Razpoložljivost') @(@('(izbrano)','10.00','10.30','Prost'),@('( )','11.00','11.30','Prost'),@('( )','11.30','12.00','Prost'))
Note 285 620 730 @('Izbrano: LJAC101 · 22. 10. 2026 · 10.00–10.30','Ob potrditvi se ponovno preveri razpoložljivost termina.')
Button 1050 635 315 'Potrdi rezervacijo'
Box 260 795 1130 290
Label 285 820 'Moje odprte rezervacije' 900 23 $true
Table 285 865 @(230,290,240,320) @('Vozilo','Termin','Stanje','Podrobnosti') @(@('LJAC202 · Polo','22. 10. · 10.30–11.00','BOOKED','Čaka na prevzem'))
Label 285 1010 'Rezultati zaključenih pregledov so v Zgodovini.' 1040 19
Save-Frame

Start-Frame 'wf-02-razpored-pregledov' 'WF-02' 'Razpored pregledov' 'Preglednik' 'Razpored' 'Razpored postaje · 22. 10. 2026 · trenutni čas 10.05'
Note 260 210 1130 @('Pregledno mesto je prosto. Vozilo prevzameš, ko prispe na pregled.','Pregled lahko začneš od začetka rezerviranega termina naprej.')
Box 260 325 1130 565
Label 285 350 'Naročena vozila' 1000 23 $true
Table 285 395 @(150,270,230,430) @('Termin','Vozilo','Stanje','Izvajalec / dostop') @(@('09.00–09.30','LJAC303 · Golf','COMPLETED','Moj pregled · odpri rezultat'),@('10.00–10.30','LJAC101 · Clio','BOOKED','Še ni prevzet'),@('10.30–11.00','LJAC202 · Polo','BOOKED','Še ni prevzet'))
Label 285 640 'Izbrano: LJAC101 · Renault Clio · 2018' 1000 22 $true
Label 285 680 'VIN: VF1ABCDE123456789' 1000 19
Button 285 735 260 'Začni pregled'
Label 285 815 'Zaključen pregled odpreš prek njegove vrstice v seznamu.' 1050 18
Note 260 925 1130 @('Termin ob 10.30: začetek še ni dovoljen.','Če pregled prevzame sodelavec, svojih ugotovitev v njem ne moreš urejati.')
Save-Frame

Start-Frame 'wf-02b-razpored-ob-zamudi' 'WF-02b' 'Razpored ob zamudi' 'Preglednik' 'Razpored' 'Alternativni primer · 22. 10. 2026 · trenutni čas 10.40'
Note 260 210 1130 @('Pregledno mesto je zasedeno. LJAC101 je še IN_PROGRESS.','Pregled presega načrtovani konec termina ob 10.30; dejanski začetek je bil ob 10.05.')
Box 260 325 1130 565
Label 285 350 'Naročena vozila · načrtovani časi ostanejo nespremenjeni' 1080 23 $true
Table 285 395 @(150,270,230,430) @('Termin','Vozilo','Stanje','Izvajalec / dostop') @(@('10.00–10.30','LJAC101 · Clio','IN_PROGRESS','Moj pregled · še poteka'),@('10.30–11.00','LJAC202 · Polo','BOOKED','Čaka na prosto mesto'))
Label 285 610 'Izbrano naslednje vozilo: LJAC202 · VW Polo' 1080 22 $true
Label 285 655 'Začetek ni mogoč: pregledno mesto je zasedeno.' 1080 20
Button 285 720 260 'Začni pregled' $true
Button 580 720 320 'Nadaljuj moj pregled'
Label 285 815 'Naslednji pregled lahko ročno prevzameš po zaključku aktivnega.' 1080 18
Note 260 925 1130 @('Pretek 30 minut ne zaključi pregleda. Naslednja rezervacija ostane BOOKED.','Po sprostitvi mesta je prevzem dovoljen tudi po načrtovanem koncu termina.')
Save-Frame

Start-Frame 'wf-03-izvedba-pregleda' 'WF-03' 'Izvedba pregleda' 'Preglednik' 'Moj pregled' 'LJAC101 · Renault Clio · 22. 10. 2026 · začetek 10.05 · izvajalec: Ana Novak'
Label 260 205 'IN_PROGRESS · 6 od 7 postavk ocenjenih · končni izid še ni določen' 1130 21 $true
Box 260 250 700 565
Label 280 270 'Kontrolni seznam' 650 23 $true
Table 280 315 @(245,235,180) @('Postavka','Ocena','Napake') @(@('Zavore','PASS','0'),@('Luči [izbrano]','FAIL','1'),@('Pnevmatike','PASS','0'),@('Krmiljenje','PASS','0'),@('Vzmetenje','PASS','0'),@('Emisije','NOT_CHECKED','0'),@('Identifikacija vozila','PASS','0'))
Button 280 755 230 'Dodaj napako'
Label 535 768 'Najprej izberi postavko.' 405 18
Box 985 250 405 650
Label 1005 270 'Postavka: Luči' 365 23 $true
Label 1005 310 'Preveri delovanje luči.' 365 18
Field 1005 350 365 'Ocena' 'FAIL     [izberi]'
Field 1005 445 365 'Opomba postavke (neobvezno)' 'Dodatna opomba …'
Button 1005 540 250 'Shrani postavko'
Label 1005 610 'Napaka 1 · urejanje' 365 21 $true
Field 1005 650 365 'Resnost' 'MINOR · manjša     [izberi]'
Field 1005 750 365 'Opis napake' 'Poškodovan pokrov luči.'
Button 1005 845 195 'Shrani napako'
Button 1215 845 155 'Odstrani'
Box 260 840 700 240
Field 280 860 660 'Splošna opomba pregleda (neobvezno)' 'Vnesi opombo …'
Button 280 960 230 'Shrani opombo'
Note 985 925 405 @('Emisije še niso ocenjene.','Zaključek ni dovoljen.')
Button 1005 1025 365 'Zaključi pregled' $true
Save-Frame

Start-Frame 'wf-04-zgodovina-in-rezultat' 'WF-04' 'Zgodovina in rezultat' 'Stranka' 'Zgodovina' 'Zaključen pregled je prikazan samo za branje.'
Field 260 210 700 'Vozilo' 'LJAC101 · Renault Clio · 2018     [izberi]'
Box 260 315 1130 165
Label 280 335 'Zgodovina izbranega vozila' 1080 22 $true
Table 280 380 @(240,390,450) @('Datum zaključka','Izid','Dejanje') @(@('22. 10. 2026','REINSPECTION_REQUIRED','Odpri podrobnosti [izbrano]'))
Box 260 510 1130 600
Label 280 532 'COMPLETED · REINSPECTION_REQUIRED' 1080 24 $true
Label 280 575 'Preglednik: Ana Novak · začetek 10.05 · zaključek 10.25' 1080 19
Table 280 625 @(330,250,500) @('Postavka','Ocena','Napake') @(@('Zavore','PASS','Brez napak'),@('Luči','FAIL','MINOR · Poškodovan pokrov luči.'),@('Pnevmatike','PASS','Brez napak'),@('Krmiljenje','PASS','Brez napak'),@('Vzmetenje','PASS','Brez napak'),@('Emisije','PASS','Brez napak'),@('Identifikacija vozila','PASS','Brez napak'))
Label 280 1060 'Nov termin ni samodejno rezerviran. Naročanje je na strani Termini.' 1080 18
Save-Frame

Start-Frame 'wf-05-prijava-in-registracija' 'WF-05' 'Prijava in registracija' 'Obiskovalec' 'Prijava / račun' 'Dve možnosti vstopa: obstoječi račun ali nov račun stranke.'
Box 260 210 535 680
Label 285 240 'Prijava' 480 25 $true
Field 285 305 485 'E-pošta' 'ime@primer.si'
Field 285 410 485 'Geslo' '••••••••'
Button 285 535 240 'Prijavi se'
Note 285 640 485 @('Ob napačnih podatkih:','Prijava ni uspela. Preveri vnos.')
Box 825 210 565 680
Label 850 240 'Nov račun stranke' 510 25 $true
Field 850 305 515 'Ime in priimek' 'Vnesi ime …'
Field 850 410 515 'E-pošta' 'ime@primer.si'
Field 850 515 515 'Geslo' '••••••••'
Label 850 620 'Vloga: stranka (izbira ni mogoča)' 515 18
Button 850 675 260 'Ustvari račun'
Label 850 760 'Ob vključeni potrditvi e-pošte:' 515 18
Label 850 795 'Za nadaljevanje potrdi svoj naslov.' 515 18
Note 260 935 1130 @('Po prijavi se odpre zaslon tvoje vloge.','Računa preglednika in administratorja sta za MVP pripravljena vnaprej.')
Save-Frame

Start-Frame 'wf-06-moja-vozila' 'WF-06' 'Moja vozila' 'Stranka' 'Moja vozila' 'Podatke vozila lahko popraviš samo pred prvo rezervacijo.'
Box 260 210 1130 260
Label 285 230 'Seznam vozil' 1000 23 $true
Table 285 275 @(210,270,250,350) @('Oznaka','Vozilo','Rezervacije','Urejanje') @(@('LJAC101','Renault Clio · 2018','Brez rezervacij','Uredi [izbrano]'),@('LJAC202','VW Polo · 2020','Ima rezervacijo','Onemogočeno'))
Button 1100 220 265 'Dodaj vozilo'
Box 260 505 1130 580
Label 285 530 'Podatki vozila · urejanje LJAC101' 1050 23 $true
Field 285 590 500 'Registrska oznaka' 'LJAC101'
Field 825 590 540 'VIN' 'VF1ABCDE123456789'
Field 285 700 500 'Proizvajalec' 'Renault'
Field 825 700 540 'Model' 'Clio'
Field 285 810 500 'Letnik' '2018'
Note 825 810 540 @('VIN: 17 znakov, brez I, O in Q.','Obvezna so vsa polja.')
Button 285 950 250 'Shrani vozilo'
Button 570 950 250 'Na termine'
Save-Frame

Start-Frame 'wf-07-objava-terminov' 'WF-07' 'Objava terminov' 'Administrator' 'Termini' 'Eno pregledno mesto · vsak termin traja 30 minut.'
Box 260 210 1130 405
Label 285 235 'Nov prost termin' 1050 23 $true
Field 285 295 320 'Datum' '22. 10. 2026'
Field 645 295 320 'Začetek' '11.00'
Field 1005 295 360 'Konec (samodejno)' '11.30' $true
Button 285 415 260 'Objavi termin'
Note 285 495 1080 @('Ob prekrivanju: termin se prekriva z obstoječim. Izberi drug začetek.','Preteklega termina ni mogoče objaviti.')
Box 260 650 1130 435
Label 285 675 'Objavljeni termini · 22. 10. 2026' 1050 23 $true
Table 285 725 @(230,230,300,320) @('Začetek','Konec','Zasedenost','Vozilo') @(@('10.00','10.30','Prost','—'),@('10.30','11.00','Rezerviran','LJAC202'),@('11.30','12.00','Prost','—'))
Label 285 990 'Urejanje in umik obstoječih terminov nista del MVP.' 1080 19
Save-Frame

Start-Frame 'wf-08-administratorske-evidence' 'WF-08' 'Evidence postaje' 'Administrator' 'Evidence' 'Bralni vpogled v vsa vozila, rezervacije in preglede.'
Box 260 210 1130 250
Label 285 230 'Vozila' 1080 23 $true
Table 285 275 @(210,270,270,330) @('Oznaka','Vozilo','Lastnik','Dejanje') @(@('LJAC101','Renault Clio · 2018','Maja Kovač','Odpri podatke'),@('LJAC303','VW Golf · 2017','Luka Horvat','Odpri podatke'))
Box 260 490 1130 250
Label 285 510 'Rezervacije · 22. 10. 2026' 1080 23 $true
Table 285 555 @(200,250,260,370) @('Termin','Vozilo','Stanje','Pregled') @(@('10.00–10.30','LJAC101','COMPLETED','Odpri rezultat'),@('10.30–11.00','LJAC202','BOOKED','Pregled še ni začet'))
Box 260 770 1130 315
Label 285 790 'Pregledi' 1080 23 $true
Table 285 835 @(200,230,390,260) @('Vozilo','Izvajalec','Končni izid','Dejanje') @(@('LJAC101','Ana Novak','REINSPECTION_REQUIRED','Odpri podrobnosti'))
Note 285 975 1080 @('Podatki so samo za branje. Objavo prostega termina odpreš v meniju Termini.')
Save-Frame
