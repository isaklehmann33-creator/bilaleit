/* Þekkt atriði að athuga eftir gerð. Handskrifuð tafla út frá algengum, vel þekktum veikleikum (innkallanir, verkstæðisreynsla).
   Þetta er gátlisti fyrir skoðun, ekki greining á tilteknum bíl: flestir bílar af gerðinni hafa ekkert af þessu.
   Hver færsla: mk = tegund, b = gerð (regex á c.base), y = [fyrsta, síðasta] árgerð, f = eldsneytisflokkur (c.fcat), t = atriði. */
(function () {
  'use strict';
  var VAG_DSG = 'Sjálfskipting DSG (7 gíra, þurrkúpling): hik eða högg í lágum hraða bendir á kúplingu eða stýrieiningu (mekatróník)';
  var VAG_TSI = '1,2/1,4 TSI (til ~2012): tímakeðja getur teygst – skrölt við kaldræsingu';
  var VAG_TDI = 'TDI dísel: EGR-ventill og sótagnasía (DPF) ef mest er ekið stuttar ferðir';
  var N47 = '2,0 dísel (N47, ~2007–2014): tímakeðjan er aftan á vélinni og getur gefið sig – skrölt aftan úr vél er viðvörun';
  var HK_DCT = 'Tvíkúplingsskipting (DCT): hik eða titringur í lágum hraða';
  var HK_DIESEL = '1,6/1,7/2,0/2,2 CRDi dísel: sótagnasía (DPF) og EGR ef mest er ekið innanbæjar';
  var LR_AIR = 'Loftfjöðrun: dæla, púðar og lekar eru algengur kostnaðarliður – athugaðu hvort bíllinn sígur eftir nótt';
  var LR_TDV6 = '2,7/3,0 TDV6 dísel: sveifarás/legur geta gefið sig – biddu um þjónustusögu með reglulegum olíuskiptum';
  var INGENIUM = '2,0 Ingenium dísel (~2015–2019): tímakeðja og olía sem þynnist (DPF-endurnýjun) – regluleg olíuskipti skipta máli';
  var MB_OM651 = '2,1 CDI (OM651): spíssar (Delphi, ~2008–2012) og túrbína';
  var MB_OM642 = '3,0 V6 CDI (OM642): olíuleki frá olíukæliþéttingu milli strokkaraða og „swirl“-lokur í soggrein';
  var MB_AIR = 'Airmatic loftfjöðrun: dæla og púðar (athugaðu hvort bíllinn sígur)';
  var PURETECH = '1,2 PureTech bensín (~2014–2022): tímareim liggur í olíu og getur trosnað – getur stíflað olíudælu; kannaðu hvort skipt hafi verið um';
  var BLUEHDI = 'BlueHDi dísel: AdBlue-tankur/dæla bilar stundum („Engine fault“/AdBlue-viðvörun)';
  var RENAULT_TCE = '1,2 TCe bensín (~2012–2016): olíunotkun getur leitt til vélarskemmda – spurðu um olíunotkun';
  var DCI = '1,5 dCi dísel: spíssar og stangarlegur á eldri vélum';
  var ECOBOOST = '1,0/1,5/1,6 EcoBoost: kælivatnsleki (sumar vélar innkallaðar) – fylgstu með kælivökvastöðu';
  var POWERSHIFT = 'PowerShift sjálfskipting (tvíkúpling, ~2011–2018): titringur við að taka af stað';
  var HEMI = '5,7 HEMI: undirlyftur og kambás (tikk) á vélum með strokkaafvirkjun (MDS/AFM)';
  var ICCU = 'Hleðslueining (ICCU) sem hleður 12V rafgeyminn hefur bilað á E-GMP-bílum – athugaðu hvort innköllun hafi verið framkvæmd';
  var HYBRID_BRAKES = 'Tvinnbílar bremsa mikið með rafmótor: bremsudiskar (sérstaklega að aftan) ryðga og festast';

  var LIST = [
    { mk: 'TOYOTA', b: /^LAND CRUISER/, f: 'Dísel', y: [2003, 2015], t: ['3,0 D-4D (1KD): spíssar og spíssaþéttingar – svartur reykur eða gangtruflanir'] },
    { mk: 'TOYOTA', b: /^LAND CRUISER/, t: ['Ryð í grind og undirvagni – skoðaðu undir bílinn', 'Loftfjöðrun að aftan í sumum útfærslum (sígur bíllinn?)'] },
    { mk: 'TOYOTA', b: /^HILUX$/, t: ['Ryð í grind og palli', 'D-4D dísel: spíssar (eldri vélar) og sótagnasía (nýrri)'] },
    { mk: 'TOYOTA', b: /^RAV4$/, f: 'Dísel', y: [2006, 2012], t: ['2,2 D-4D: heddpakkning og olíunotkun'] },
    { mk: 'TOYOTA', b: /^RAV4$/, t: ['Ryð í undirvagni og afturbita á eldri bílum'] },
    { mk: 'TOYOTA', b: /^(AURIS|COROLLA)$/, f: 'Dísel', t: ['D-4D dísel: kúpling/tvímassasvinghjól og sótagnasía'] },
    { mk: 'TOYOTA', b: /^BZ4X$/, t: ['Hraðhleðsla hægist í kulda (fyrstu árgerðir) – athugaðu hugbúnaðaruppfærslur'] },
    { mk: 'TOYOTA', b: /^PROACE$/, f: 'Dísel', t: [BLUEHDI] },
    { mk: 'LEXUS', b: /^(RX|NX|UX)$/, t: ['Almennt mjög áreiðanleg gerð – þjónustusaga hjá umboði er kostur'] },

    { mk: 'KIA', b: /^(SPORTAGE|SORENTO|CEED|XCEED|PROCEED|OPTIMA|STONIC|NIRO)$/, f: 'Dísel', t: [HK_DIESEL] },
    { mk: 'HYUNDAI', b: /^(TUCSON|SANTA FE|I30|I40|IX35)$/, f: 'Dísel', t: [HK_DIESEL] },
    { mk: 'KIA', b: /^(SPORTAGE|CEED|XCEED|PROCEED|NIRO|STONIC)$/, y: [2015, 2026], t: [HK_DCT] },
    { mk: 'HYUNDAI', b: /^(TUCSON|I30|KONA|I20)$/, y: [2015, 2026], t: [HK_DCT] },
    { mk: 'KIA', b: /^(SPORTAGE|SORENTO)$/, t: ['Fjórhjóladrif: tengikúpling að aftan þarf olíuskipti'] },
    { mk: 'KIA', b: /^EV6$/, t: [ICCU] },
    { mk: 'HYUNDAI', b: /^IONIQ [56]$/, t: [ICCU] },
    { mk: 'HYUNDAI', b: /^KONA$/, f: 'Rafmagn', y: [2018, 2020], t: ['Kona Electric 2018–2020: rafhlöðuinnköllun (eldhætta) – athugaðu hvort skipt hafi verið um rafhlöðu'] },
    { mk: 'KIA', b: /^SOUL$/, f: 'Rafmagn', t: ['Eldri Soul EV: rafhlaðan án virkrar kælingar tapar drægni – athugaðu rafhlöðuheilsu'] },

    { mk: 'LAND ROVER', b: /^DISCOVERY$/, y: [2004, 2016], t: [LR_AIR, LR_TDV6, 'Ryð í grind/undirvagni á eldri bílum'] },
    { mk: 'LAND ROVER', b: /^DISCOVERY$/, y: [2017, 2026], t: [LR_AIR, 'Rafkerfi og hugbúnaður (upplýsingaskjár, skynjarar)', 'AdBlue-kerfi á dísel'] },
    { mk: 'LAND ROVER', b: /^DEFENDER$/, y: [1983, 2016], t: ['Ryð í grind, hurðum og fótrými', 'Vatnsleki inn í bíl er algengur'] },
    { mk: 'LAND ROVER', b: /^DEFENDER$/, y: [2020, 2026], t: ['Rafkerfi og hugbúnaður (sérstaklega fyrstu árgerðir)', LR_AIR] },
    { mk: 'LAND ROVER', b: /^RANGE ROVER( SPORT)?$/, t: [LR_AIR, 'Rafkerfi og stýrieiningar – athugaðu að allt virki'] },
    { mk: 'LAND ROVER', b: /^RANGE ROVER( SPORT)?$/, f: 'Dísel', y: [2005, 2016], t: [LR_TDV6] },
    { mk: 'LAND ROVER', b: /^(RANGE ROVER EVOQUE|DISCOVERY SPORT|RANGE ROVER VELAR)$/, f: 'Dísel', y: [2015, 2019], t: [INGENIUM] },
    { mk: 'LAND ROVER', b: /^(RANGE ROVER EVOQUE|DISCOVERY SPORT)$/, t: ['9 gíra sjálfskipting (ZF): hörð eða hikandi skipting – hugbúnaðaruppfærsla hjálpar oft'] },
    { mk: 'JAGUAR', b: /^(F-PACE|E-PACE|XE|XF)$/, f: 'Dísel', y: [2015, 2019], t: [INGENIUM] },

    { mk: 'VOLVO', b: /^XC90$/, y: [2002, 2014], t: ['Sjálfskipting (Geartronic): hik eða högg milli gíra', 'D5 dísel: tímareim og „swirl“-lokur'] },
    { mk: 'VOLVO', b: /^(XC90|XC60|V60|V90|S90|XC40)$/, f: 'Tengiltvinn', t: ['T6/T8 tengiltvinn: rafhlaða og hleðslutæki – athugaðu rafdrægni'] },
    { mk: 'VOLVO', b: /^(XC90|XC60|V60|S60|V70|XC70)$/, f: 'Dísel', y: [2008, 2016], t: ['D3/D4/D5 (5 strokka): tímareim á réttum tíma (~150–180 þús. km)'] },
    { mk: 'VOLVO', b: /^XC90$/, y: [2015, 2026], t: ['Loftfjöðrun (ef til staðar) og upplýsingaskjár'] },

    { mk: 'VOLKSWAGEN', b: /^(GOLF|POLO|PASSAT|TIGUAN|CADDY|TOURAN|T-ROC|JETTA|SCIROCCO)$/, t: [VAG_DSG] },
    { mk: 'VOLKSWAGEN', b: /^(GOLF|POLO|PASSAT|TIGUAN|CADDY|TOURAN|JETTA)$/, f: 'Bensín', y: [2006, 2012], t: [VAG_TSI] },
    { mk: 'VOLKSWAGEN', b: /^(GOLF|PASSAT|TIGUAN|CADDY|TOURAN|TOUAREG|TRANSPORTER|CARAVELLE|AMAROK)$/, f: 'Dísel', t: [VAG_TDI] },
    { mk: 'VOLKSWAGEN', b: /^TIGUAN$/, f: 'Bensín', y: [2007, 2011], t: ['2,0 TSI: olíunotkun (stimplahringir)'] },
    { mk: 'VOLKSWAGEN', b: /^(TRANSPORTER|CARAVELLE|MULTIVAN)$/, t: ['Ryð í sílsum, hjólaskálum og hurðum', 'Tvímassasvinghjól og kúpling (beinskiptir)'] },
    { mk: 'VOLKSWAGEN', b: /^(ID\.3|ID\.4|ID\.5|ID\.7|ID\. BUZZ)$/, t: ['Hugbúnaður: athugaðu að nýjasta uppfærsla sé komin', '12V rafgeymir tæmist stundum'] },
    { mk: 'SKODA', b: /^(OCTAVIA|SUPERB|FABIA|KODIAQ|KAROQ|RAPID|SCALA|KAMIQ|YETI)$/, t: [VAG_DSG] },
    { mk: 'SKODA', b: /^(OCTAVIA|SUPERB|FABIA|YETI|RAPID)$/, f: 'Bensín', y: [2006, 2012], t: [VAG_TSI] },
    { mk: 'SKODA', b: /^(OCTAVIA|SUPERB|KODIAQ|KAROQ|YETI)$/, f: 'Dísel', t: [VAG_TDI] },
    { mk: 'SKODA', b: /^(OCTAVIA|SUPERB|KAROQ|FABIA|SCALA|KAMIQ)$/, f: 'Bensín', y: [2013, 2020], t: ['1,0/1,4/1,5 TSI: vatnsdæla/hitastillir í plasthúsi lekur stundum'] },
    { mk: 'SKODA', b: /^(ENYAQ|ELROQ)$/, t: ['Hugbúnaður: athugaðu að nýjasta uppfærsla sé komin', '12V rafgeymir tæmist stundum'] },
    { mk: 'AUDI', b: /^(A3|A4|A5|A6|Q2|Q3|Q5|TT)$/, t: ['S tronic sjálfskipting: hik í lágum hraða bendir á kúplingu eða stýrieiningu'] },
    { mk: 'AUDI', b: /^(A4|A5|Q5|A6)$/, f: 'Bensín', y: [2008, 2012], t: ['2,0 TFSI: mikil olíunotkun (stimplahringir)'] },
    { mk: 'AUDI', b: /^(A3|A4|A6|Q3|Q5|Q7)$/, f: 'Dísel', t: [VAG_TDI] },
    { mk: 'AUDI', b: /^Q7$/, t: ['Loftfjöðrun (ef til staðar)', '3,0 TDI: tímakeðjur (aftan á vél) á eldri vélum'] },
    { mk: 'AUDI', b: /^(E-TRON|Q8|Q8 E-TRON)$/, f: 'Rafmagn', t: ['Innköllun 2019–2020 vegna rafhlöðuþéttinga – athugaðu hvort framkvæmd', 'Þungur bíll: dekk og bremsur slitna hraðar'] },
    { mk: 'PORSCHE', b: /^CAYENNE$/, y: [2003, 2010], t: ['V8: kælivatnsrör úr plasti undir soggrein leka', 'Drifskaftsupphengja (miðjulega)', 'Loftfjöðrun (ef til staðar)'] },
    { mk: 'PORSCHE', b: /^(CAYENNE|MACAN|PANAMERA)$/, t: ['Bremsur og dekk eru dýr – athugaðu slit'] },
    { mk: 'PORSCHE', b: /^TAYCAN$/, t: ['Athugaðu rafhlöðuheilsu og innkallanir (12V kerfi)'] },

    { mk: 'BMW', b: /^(1 SERIES|3 SERIES|5 SERIES|X1|X3)$/, f: 'Dísel', y: [2007, 2014], t: [N47] },
    { mk: 'BMW', b: /^(3 SERIES|5 SERIES|X1|X3|X5|X6)$/, f: 'Dísel', y: [2011, 2018], t: ['EGR-kælir í dísel (innköllun) – athugaðu hvort framkvæmd'] },
    { mk: 'BMW', b: /^(X5|X6)$/, t: ['Loftfjöðrun að aftan og millikassi (stýrimótor)', 'Olíulekar frá ventlaloki og olíusíuhúsi'] },
    { mk: 'BMW', b: /^(X5|X3|5 SERIES|3 SERIES|X1|2 SERIES)$/, f: 'Tengiltvinn', t: ['Tengiltvinn: rafhlaða og hleðslutæki – athugaðu rafdrægni'] },

    { mk: 'MERCEDES-BENZ', b: /^(C|E|GLC|GLK|SPRINTER|VITO|V|CLA|ML|GLE)$/, f: 'Dísel', y: [2008, 2016], t: [MB_OM651] },
    { mk: 'MERCEDES-BENZ', b: /^(ML|GLE|GL|GLS|E|S|R|SPRINTER)$/, f: 'Dísel', y: [2005, 2018], t: [MB_OM642] },
    { mk: 'MERCEDES-BENZ', b: /^(ML|GL|GLE|GLS|E|S|R)$/, t: [MB_AIR] },
    { mk: 'MERCEDES-BENZ', b: /^(ML|E|S|R|C|CLK|CLS|SL)$/, y: [2003, 2012], t: ['7G-Tronic sjálfskipting: leiðsluplata/stýrieining – högg eða neyðargír'] },
    { mk: 'MERCEDES-BENZ', b: /^E$/, y: [2002, 2006], t: ['SBC-hemlakerfi (rafstýrð bremsudæla) – viðvörun í mælaborði'] },
    { mk: 'MERCEDES-BENZ', b: /^S$/, y: [1998, 2006], t: ['S400 CDI (V8 dísel): túrbínur og spíssar', 'Drifskaftsupphengja (miðjulega)'] },
    { mk: 'MERCEDES-BENZ', b: /^(CLA|A|B|GLA)$/, y: [2013, 2019], t: ['7G-DCT tvíkúplingsskipting: hik eða högg í lágum hraða'] },
    { mk: 'MERCEDES-BENZ', b: /^(SPRINTER|VITO)$/, t: ['Ryð í hjólaskálum, sílsum og undirvagni', 'AdBlue-kerfi á nýrri dísel'] },
    { mk: 'MERCEDES-BENZ', b: /^EQC$/, t: ['Innbyggt hleðslutæki og 12V-kerfi (innkallanir) – athugaðu hvort framkvæmd'] },

    { mk: 'NISSAN', b: /^(QASHQAI|JUKE|X-TRAIL)$/, f: 'Bensín', y: [2013, 2018], t: ['1,2 DIG-T: tímakeðja og olíunotkun'] },
    { mk: 'NISSAN', b: /^(QASHQAI|X-TRAIL|JUKE)$/, t: ['CVT sjálfskipting (Xtronic): suð eða hik – olíuskipti skipta máli'] },
    { mk: 'NISSAN', b: /^(QASHQAI|X-TRAIL|NAVARA)$/, f: 'Dísel', t: [DCI] },
    { mk: 'NISSAN', b: /^NAVARA$/, t: ['Ryð í grind (D40 og eldri)'] },
    { mk: 'NISSAN', b: /^LEAF$/, t: ['Rafhlaðan hefur ekki virka kælingu og tapar drægni með aldri – athugaðu rafhlöðuheilsu (stikur á mælaborði)'] },
    { mk: 'MITSUBISHI', b: /^OUTLANDER$/, f: 'Tengiltvinn', t: ['Tengiltvinn: rafhlöðuheilsa og hleðsla – athugaðu rafdrægni', 'Ryð í undirvagni'] },
    { mk: 'MITSUBISHI', b: /^(OUTLANDER|ASX|ECLIPSE CROSS|ECLIPSE)$/, f: 'Bensín', t: ['CVT sjálfskipting: olíuskipti skipta máli'] },
    { mk: 'MITSUBISHI', b: /^(PAJERO|L200)$/, t: ['Ryð í grind', 'DI-D dísel: spíssar og tímakeðja (L200 2,5)'] },

    { mk: 'TESLA', b: /^MODEL [3YSX]$/, t: ['Framfjöðrunararmar: brak/slag á ójöfnum', '12V rafgeymir (eldri bílar)', 'Þungur bíll: dekk slitna hraðar'] },
    { mk: 'POLESTAR', b: /^2$/, t: ['Hugbúnaður og 12V rafgeymir (fyrstu árgerðir)'] },
    { mk: 'MG', b: /^(ZS|MG4|MG5|HS|EHS)$/, t: ['Hugbúnaður og upplýsingaskjár – athugaðu uppfærslur'] },

    { mk: 'DACIA', b: /^(DUSTER|SANDERO|LOGAN|JOGGER)$/, t: ['Ryðvörn er þunn: skoðaðu undirvagn, sílsa og festingar'] },
    { mk: 'DACIA', b: /^(DUSTER|SANDERO|LOGAN)$/, f: 'Dísel', t: [DCI] },
    { mk: 'DACIA', b: /^(DUSTER|SANDERO|LOGAN)$/, f: 'Bensín', y: [2012, 2016], t: [RENAULT_TCE] },
    { mk: 'RENAULT', b: /^(MEGANE|CLIO|CAPTUR|KADJAR|SCENIC|KANGOO)$/, f: 'Bensín', y: [2012, 2016], t: [RENAULT_TCE] },
    { mk: 'RENAULT', b: /^(MEGANE|CLIO|CAPTUR|KADJAR|SCENIC|KANGOO|TRAFIC)$/, f: 'Dísel', t: [DCI] },
    { mk: 'RENAULT', b: /^(MEGANE|CLIO|CAPTUR|KADJAR)$/, t: ['EDC tvíkúplingsskipting: hik eða titringur við að taka af stað'] },
    { mk: 'RENAULT', b: /^(TRAFIC|MASTER)$/, t: ['Ryð í undirvagni og hurðum', 'Tvímassasvinghjól og kúpling'] },
    { mk: 'RENAULT', b: /^ZOE$/, t: ['Athugaðu hvort rafhlaðan er í eigu eða leigu (eldri bílar)', 'Rafhlöðuheilsa'] },
    { mk: 'PEUGEOT', b: /^(208|2008|308|3008|5008|508|RIFTER|PARTNER)$/, f: 'Bensín', y: [2014, 2022], t: [PURETECH] },
    { mk: 'PEUGEOT', b: /^(208|2008|308|3008|5008|508|RIFTER|PARTNER|EXPERT|TRAVELLER|BOXER)$/, f: 'Dísel', y: [2014, 2026], t: [BLUEHDI] },
    { mk: 'CITROEN', b: /^(C3|C4|C5|C3 AIRCROSS|C5 AIRCROSS|BERLINGO|C4 PICASSO)$/, f: 'Bensín', y: [2014, 2022], t: [PURETECH] },
    { mk: 'CITROEN', b: /^(C3|C4|C5|C3 AIRCROSS|C5 AIRCROSS|BERLINGO|JUMPY|JUMPER|C4 PICASSO|SPACETOURER)$/, f: 'Dísel', y: [2014, 2026], t: [BLUEHDI] },
    { mk: 'OPEL', b: /^(CORSA|MOKKA|GRANDLAND|CROSSLAND)$/, f: 'Bensín', y: [2017, 2022], t: [PURETECH] },

    { mk: 'FORD', b: /^(FOCUS|FIESTA|KUGA|C-MAX|ECOSPORT|PUMA|MONDEO)$/, f: 'Bensín', y: [2012, 2020], t: [ECOBOOST] },
    { mk: 'FORD', b: /^(FOCUS|FIESTA|KUGA|C-MAX|MONDEO|ECOSPORT)$/, y: [2011, 2018], t: [POWERSHIFT] },
    { mk: 'FORD', b: /^KUGA$/, f: 'Tengiltvinn', y: [2020, 2021], t: ['Kuga PHEV 2020–2021: rafhlöðuinnköllun (eldhætta) – athugaðu hvort framkvæmd'] },
    { mk: 'FORD', b: /^(TRANSIT|TRANSIT CUSTOM|TOURNEO)$/, t: ['Ryð í undirvagni, hurðum og hjólaskálum'] },
    { mk: 'FORD', b: /^(TRANSIT|TRANSIT CUSTOM|TOURNEO|RANGER|FOCUS|KUGA)$/, f: 'Dísel', y: [2016, 2026], t: ['2,0 EcoBlue: tímareim fyrir olíudælu liggur í olíu og getur trosnað – athugaðu þjónustusögu'] },
    { mk: 'FORD', b: /^(F150|F-150)$/, f: 'Bensín', t: ['3,5 EcoBoost: kambásstillar (skrölt við kaldræsingu) og tímakeðja'] },
    { mk: 'FORD', b: /^(F250|F350|F-250|F-350)$/, f: 'Dísel', y: [2003, 2010], t: ['6,0/6,4 Powerstroke: heddpakkningar, EGR-kælir og olíukælir – dýrar viðgerðir'] },
    { mk: 'FORD', b: /^(F150|F250|F350|RANGER|F-150|F-250|F-350)$/, t: ['Ryð í grind og palli'] },
    { mk: 'DODGE', b: /^RAM$/, f: 'Bensín', t: [HEMI] },
    { mk: 'RAM', b: /^(1500|2500|3500|RAM)$/, f: 'Bensín', t: [HEMI] },
    { mk: 'DODGE', b: /^RAM$/, f: 'Dísel', t: ['6,7 Cummins: EGR og sótagnasía, en vélin sjálf endingargóð'] },
    { mk: 'RAM', b: /^(2500|3500)$/, f: 'Dísel', t: ['6,7 Cummins: EGR og sótagnasía, en vélin sjálf endingargóð'] },
    { mk: 'GMC', b: /^SIERRA$/, f: 'Bensín', t: ['5,3/6,2 V8: undirlyftur á vélum með strokkaafvirkjun (AFM/DFM)'] },
    { mk: 'CHEVROLET', b: /^(SILVERADO|TAHOE|SUBURBAN)$/, f: 'Bensín', t: ['5,3/6,2 V8: undirlyftur á vélum með strokkaafvirkjun (AFM/DFM)'] },
    { mk: 'JEEP', b: /^WRANGLER$/, t: ['Titringur í stýri á ákveðnum hraða („death wobble“): stýrisdempari og framöxull', 'Ryð í grind', 'Leki með mjúku/lausu þaki'] },
    { mk: 'JEEP', b: /^(COMPASS|RENEGADE|CHEROKEE)$/, t: ['9 gíra sjálfskipting: hik eða hörð skipting – hugbúnaðaruppfærsla hjálpar oft', 'Rafkerfi og skynjarar'] },
    { mk: 'JEEP', b: /^(COMPASS|RENEGADE)$/, f: 'Tengiltvinn', t: ['4xe tengiltvinn: rafhlaða og hleðslutæki'] },
    { mk: 'JEEP', b: /^GRAND CHEROKEE$/, t: ['Loftfjöðrun (Quadra-Lift) ef til staðar', 'Rafkerfi og stýrieiningar'] },

    { mk: 'HONDA', b: /^(CR-V|CIVIC|HR-V)$/, f: 'Dísel', t: ['i-DTEC dísel: sótagnasía (DPF) ef mest ekið stuttar ferðir'] },
    { mk: 'HONDA', b: /^(CR-V|CIVIC)$/, f: 'Bensín', y: [2017, 2022], t: ['1,5 VTEC Turbo: bensín í olíu í miklum kulda (hugbúnaðaruppfærsla)'] },
    { mk: 'HONDA', b: /^CR-V$/, y: [2007, 2012], t: ['Kúpling á loftkælingarpressu'] },
    { mk: 'MAZDA', b: /^(CX-5|6|3|CX-3)$/, f: 'Dísel', t: ['2,2 Skyactiv-D: sót og olía sem þynnist ef mest ekið stuttar ferðir; spíssaþéttingar'] },
    { mk: 'SUZUKI', b: /^(JIMNY|VITARA|GRAND VITARA|SX4|SWIFT|S-CROSS|IGNIS)$/, t: ['Ryð í undirvagni og grind (Jimny) – skoðaðu vel'] },
    { mk: 'SUZUKI', b: /^(SX4|S-CROSS|VITARA)$/, f: 'Dísel', t: ['DDiS dísel: sótagnasía (DPF)'] }
  ];

  // almenn atriði eftir eldsneyti, aldri og akstri
  function general(c) {
    var t = [], age = (new Date().getFullYear()) - (c.year || 0);
    if (c.fcat === 'Rafmagn') t.push('Biddu um rafhlöðuheilsu (SoH), t.d. skýrslu frá umboði – hún skiptir meira máli en akstur');
    if (c.fcat === 'Tengiltvinn') t.push('Tengiltvinn: athugaðu rafdrægni og að hleðslusnúra fylgi');
    if (c.fcat === 'Tvinn' || c.fcat === 'Tengiltvinn') t.push(HYBRID_BRAKES);
    if (/\bdsg\b|s.?tronic/i.test(c.title || '') && !/^(VOLKSWAGEN|SKODA|AUDI|SEAT|CUPRA)$/.test(c.make) && c.auto !== false) t.push(VAG_DSG);
    if (c.year && age >= 12) t.push('Ryð í undirvagni, sílsum og bremsulögnum (salt á íslenskum vegum)');
    if (c.km >= 200000) t.push('Yfir 200.000 km: tímareim/-keðja, kúpling eða skipting, fjöðrun og hjólalegur – biddu um viðgerðasögu');
    else if (c.km >= 120000 && c.fcat !== 'Rafmagn') t.push('Tímareim er yfirleitt skipt á 120–180 þús. km – spurðu hvort það sé búið');
    return t;
  }

  // atriði um sjálfskiptingar eiga ekki við beinskipta bíla
  var AUTO = /sjálfskipting|DSG|S tronic|tvíkúpling|DCT|PowerShift|EDC|7G-|CVT|Geartronic|9 gíra/;
  function forCar(c) {
    var out = [], seen = {};
    LIST.forEach(function (e) {
      if (e.mk !== c.make || !e.b.test(c.base || '')) return;
      if (e.f && e.f !== c.fcat) return;
      if (e.y && c.year && (c.year < e.y[0] || c.year > e.y[1])) return;
      e.t.forEach(function (x) { if (!seen[x] && !(c.auto === false && AUTO.test(x))) { seen[x] = 1; out.push({ t: x, own: true }); } });
    });
    general(c).forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push({ t: x, own: false }); } });
    return out;
  }

  function html(c) {
    var xs = forCar(c);
    if (!xs.length) return '';
    var esc = window.App ? App.esc : function (s) { return s; };
    return '<div class="faults"><h4>' + ic('list-checks') + 'Gott að athuga</h4><ul>' +
      xs.map(function (x) { return '<li class="' + (x.own ? 'own' : '') + '">' + ic(x.own ? 'wrench' : 'check') + '<span>' + esc(x.t) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="note">Þekktir veikleikar gerðarinnar og almenn atriði, ekki greining á þessum bíl. Ástandsskoðun á verkstæði fyrir kaup tekur af allan vafa.</p></div>';
  }

  // ---------- skoðunarlisti fyrir tiltekinn bíl (til að hafa í símanum eða prenta) ----------
  var FROM_AD = { tjon: 'Seljandi nefnir tjón: biddu um tjónaskýrslu og myndir af viðgerð', ryd: 'Ryð er nefnt í lýsingu: skoðaðu sílsa, hjólaskálar og undirvagn',
    laga: 'Lýsingin nefnir að eitthvað þurfi að laga: fáðu skriflegt hvað og hvað það kostar', skodun: 'Endurskoðun eða athugasemd í skoðun: biddu um skoðunarvottorðið',
    serut: 'Sérútbúinn eða verkefnabíll: athugaðu skráningu og hvort breytingar séu samþykktar' };
  function checklist(c) {
    var A = window.App, sec = [];
    var own = forCar(c);
    var ad = (c.fl || []).filter(function (f) { return FROM_AD[f]; }).map(function (f) { return FROM_AD[f]; })
      .concat((c.rep || []).map(function (r) { return r[1] + ': nefnt í lýsingu – ~' + A.kr(r[2]) + '–' + A.kr(r[3]) + ' í viðgerð'; }));
    if (c.kmBack) ad.push('Akstur lækkaði í auglýsingu: berðu kílómetrastöðu saman við skoðunarferil');
    if (c.vis) ad.push('Myndgreining bendir til tjóns eða viðgerðar: skoðaðu yfirbyggingu vel');
    if (ad.length) sec.push(['Úr auglýsingunni', ad]);
    if (own.length) sec.push(['Þekkt á þessari gerð', own.map(function (x) { return x.t; })]);
    var ev = c.fcat === 'Rafmagn';
    var gen = (ev ? [] : ['Kaldræsing: hlustaðu eftir skrölti og sjáðu hvort reykur kemur úr pústi']).concat([
      'Reynsluakstur: bremsur, stýri (togar til hliðar?), ' + (ev ? 'fjöðrun' : 'skipting') + ' og hljóð á 80–90 km/klst',
      'Viðvörunarljós í mælaborði eftir ræsingu', ev ? 'Undir bílinn: skemmdir á rafhlöðuhlíf, ryð' : 'Undir bílinn: olíu- og vökvalekar, ryð',
      'Dekk: mynstur og jafnt slit (ójafnt slit = hjólastilling eða fjöðrun)', 'Rafbúnaður: rúður, miðstöð, loftkæling, skjár, myndavél',
      'Báðir lyklar fylgja?']);
    if (c.fcat === 'Rafmagn' || c.fcat === 'Tengiltvinn') gen.unshift('Prófaðu hleðslu og athugaðu hleðslusnúru');
    sec.push(['Við skoðun', gen]);
    var q = ['Af hverju er bíllinn til sölu og hve lengi hefur þú átt hann?', 'Hefur hann lent í tjóni?', 'Er þjónustubók/smurbók og viðgerðareikningar?',
      'Fékk hann athugasemd í síðustu skoðun?'];
    if (c.fcat !== 'Rafmagn' && c.km >= 90000) q.splice(2, 0, 'Hvenær var skipt um tímareim/-keðju og vatnsdælu?');
    if (c.auto && c.km >= 100000) q.push('Hefur verið skipt um olíu á sjálfskiptingu?');
    if (c.fcat === 'Rafmagn') q.push('Er til skýrsla um rafhlöðuheilsu (SoH)?');
    q.push('Má fara með hann í ástandsskoðun á verkstæði?');
    sec.push(['Spurningar til seljanda', q]);
    return sec;
  }
  function openChecklist(c) {
    var A = window.App, key = 'chk:' + c.id, done = {};
    try { done = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) {}
    var sec = checklist(c), i = 0;
    A.openModal('<div class="m chk"><div class="m-head"><button type="button" class="chk-back" id="chkBack" aria-label="Til baka í bílinn">' + ic('chevron-left') + '</button>' +
      '<h2>Skoðunarlisti</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p class="note">' + A.esc(A.cap(c.make) + ' ' + A.cap(c.model)) + ' · ' + [c.year, A.kmFmt(c.km), A.kr(c.price)].filter(Boolean).join(' · ') + '</p>' +
      sec.map(function (s) {
        return '<h4>' + A.esc(s[0]) + '</h4><ul>' + s[1].map(function (t) {
          var id = 'k' + (i++);
          return '<li><label><input type="checkbox" data-k="' + id + '"' + (done[id] ? ' checked' : '') + '><span>' + A.esc(t) + '</span></label></li>';
        }).join('') + '</ul>';
      }).join('') +
      '<div class="actions"><button type="button" class="sec" id="chkPrint">' + ic('list-checks') + 'Prenta</button>' +
      '<button type="button" class="sec" id="chkShare">' + ic('share-2') + 'Senda í símann</button></div>' +
      '<p class="note">Hakið vistast í þessum vafra. Listinn er leiðbeinandi; ástandsskoðun á verkstæði er öruggust.</p></div>', 'chk-dlg');
    document.querySelectorAll('.chk input[data-k]').forEach(function (x) {
      x.addEventListener('change', function () { done[x.getAttribute('data-k')] = x.checked; try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) {} });
    });
    document.getElementById('chkBack').addEventListener('click', function () { A.showCar(c); });
    document.getElementById('chkPrint').addEventListener('click', function () { window.print(); });
    document.getElementById('chkShare').addEventListener('click', function () {
      var txt = 'Skoðunarlisti: ' + A.cap(c.make) + ' ' + A.cap(c.model) + ' (' + [c.year, A.kmFmt(c.km)].filter(Boolean).join(', ') + ')\n\n' +
        sec.map(function (s) { return s[0].toUpperCase() + '\n' + s[1].map(function (t) { return '☐ ' + t; }).join('\n'); }).join('\n\n') + '\n\n' + location.origin + '/#bill=' + encodeURIComponent(c.id);
      if (navigator.share) navigator.share({ title: 'Skoðunarlisti', text: txt }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { document.getElementById('chkShare').lastChild.textContent = 'Afritað!'; });
    });
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {  // pages.js keyrir þetta líka í Node
    var b = e.target.closest && e.target.closest('[data-check]');
    if (!b) return;
    var id = b.getAttribute('data-check'), c = window.App.cars().filter(function (x) { return x.id === id; })[0];
    if (c) openChecklist(c);
  });

  window.Faults = { forCar: forCar, html: html, list: LIST, checklist: checklist, openChecklist: openChecklist };
})();
