/* Dæmigerð uppgefin drægni (WLTP, km) rafbíla eftir gerð, þegar auglýsingin nefnir hana ekki.
   Bil = minnsta og stærsta rafhlaða / útgáfa gerðarinnar. Nákvæm drægni fer eftir rafhlöðu og árgerð.
   EV.range(c) -> [lægst, hæst] eða null. Raðað frá sértækustu reglu til almennustu; fyrsta sem passar gildir. */
(function (root) {
  'use strict';
  // [tegund, mynstur á gerð (lágstafir, án kommu), drægni lægst, hæst, frá árg., til árg.]
  var T = [
    ['TESLA', /model ?y/, 430, 600], ['TESLA', /model ?3/, 400, 630], ['TESLA', /model ?s/, 500, 650], ['TESLA', /model ?x/, 470, 580],
    ['MERCEDES-BENZ', /eqc/, 400, 440], ['MERCEDES-BENZ', /eqa/, 410, 560], ['MERCEDES-BENZ', /eqb/, 400, 470],
    ['MERCEDES-BENZ', /eqe/, 540, 660], ['MERCEDES-BENZ', /eqs/, 600, 780], ['MERCEDES-BENZ', /eqv/, 350, 360],
    ['AUDI', /q4/, 480, 530], ['AUDI', /q6/, 540, 640],
    ['AUDI', /e-?tron gt|rs ?e-?tron/, 470, 490], ['AUDI', /q8.*55|55.*q8/, 580, 600], ['AUDI', /q8/, 490, 500],
    ['AUDI', /e-?tron s\b(?! ?line)/, 360, 370], ['AUDI', /e-?tron.*50|50.*e-?tron/, 300, 340], ['AUDI', /e-?tron/, 400, 446],
    ['TOYOTA', /bz4x/, 410, 570], ['TOYOTA', /proace/, 280, 330], ['LEXUS', /ux ?300/, 315, 450],
    ['NISSAN', /leaf.*62|leaf.*e\+/, 385, 385], ['NISSAN', /leaf.*40/, 270, 270], ['NISSAN', /leaf/, 120, 200, 0, 2017], ['NISSAN', /leaf/, 270, 385], ['NISSAN', /ariya/, 400, 530],
    ['VOLKSWAGEN', /id\.? ?4.*gtx|id\.? ?5/, 460, 520], ['VOLKSWAGEN', /id\.? ?4/, 360, 530], ['VOLKSWAGEN', /id\.? ?3/, 350, 550],
    ['VOLKSWAGEN', /id\.? ?buzz/, 420, 470], ['VOLKSWAGEN', /golf/, 130, 230], ['VOLKSWAGEN', /up/, 160, 260],
    ['MG', /zs/, 260, 440], ['MG', /mg ?4/, 350, 520], ['MG', /mg ?5/, 380, 400], ['MAXUS', /euniq ?6/, 350, 360],
    ['FORD', /mach-?e/, 400, 610], ['FORD', /lightning/, 370, 515],
    ['HYUNDAI', /ioniq ?5/, 380, 570], ['HYUNDAI', /ioniq ?6/, 520, 614], ['HYUNDAI', /kona/, 300, 300, 0, 2018], ['HYUNDAI', /kona/, 300, 510], ['HYUNDAI', /ioniq/, 200, 310],
    ['KIA', /ev ?6/, 390, 530], ['KIA', /ev ?9/, 500, 560], ['KIA', /niro/, 450, 460], ['KIA', /soul/, 150, 160, 0, 2019], ['KIA', /soul/, 450, 450],
    ['SKODA', /enyaq/, 400, 560], ['SKODA', /elroq/, 375, 580], ['CUPRA', /born/, 420, 550],
    ['RENAULT', /megane/, 300, 470], ['RENAULT', /zoe/, 150, 240, 0, 2016], ['RENAULT', /zoe/, 300, 395], ['RENAULT', /scenic/, 430, 620],
    ['PORSCHE', /taycan/, 400, 630], ['PORSCHE', /macan/, 590, 640],
    ['BMW', /ix ?1/, 430, 475], ['BMW', /ix ?3/, 460, 460], ['BMW', /i4/, 420, 590], ['BMW', /i5/, 500, 580], ['BMW', /i7/, 560, 625],
    ['BMW', /ix\b|ix ?x?drive/, 420, 630], ['BMW', /i3/, 130, 160, 0, 2016], ['BMW', /i3/, 235, 310],
    ['POLESTAR', /^2|polestar ?2/, 440, 650], ['POLESTAR', /^3|polestar ?3/, 560, 630], ['POLESTAR', /^4|polestar ?4/, 590, 620],
    ['JAGUAR', /i-?pace/, 470, 470], ['CHEVROLET', /silverado/, 580, 720], ['CHEVROLET', /bolt/, 380, 420], ['CADILLAC', /lyriq/, 500, 530],
    ['AIWAYS', /u5/, 400, 410], ['VOLVO', /xc ?40|ex ?40/, 410, 570], ['VOLVO', /c ?40|ec ?40/, 440, 580], ['VOLVO', /ex ?30/, 340, 480], ['VOLVO', /ex ?90/, 580, 600],
    ['MAZDA', /mx-?30/, 200, 200], ['CITROEN', /c4/, 350, 420], ['PEUGEOT', /208/, 340, 400], ['PEUGEOT', /2008/, 320, 406], ['OPEL', /corsa/, 337, 400], ['OPEL', /mokka/, 320, 400],
    ['BYD', /atto ?3/, 420, 420], ['BYD', /seal ?u/, 420, 500], ['BYD', /seal/, 520, 570], ['BYD', /dolphin/, 340, 427], ['BYD', /tang/, 400, 530],
    ['SMART', /./, 130, 160, 0, 2022], ['SMART', /#?1|#?3/, 310, 440], ['HONDA', /\be\b/, 210, 220], ['FIAT', /500/, 190, 320], ['DACIA', /spring/, 225, 230],
    ['LEXUS', /rz/, 400, 440], ['SUBARU', /solterra/, 410, 470], ['VOLKSWAGEN', /id\.? ?7/, 600, 700], ['VOLKSWAGEN', /id\.? ?6/, 440, 560],
    ['KIA', /ev ?3/, 430, 600], ['MAXUS', /euniq ?5/, 265, 265], ['MAXUS', /deliver ?9/, 230, 350], ['HONGQI', /e-?hs9/, 460, 510], ['MG', /marvel/, 400, 450],
    ['TOYOTA', /urban cruiser/, 300, 400], ['GMC', /sierra/, 700, 740], ['GMC', /hummer/, 500, 600], ['HUMMER', /./, 500, 600], ['MERCEDES-BENZ', /g ?580/, 470, 470],
    ['NISSAN', /e-?nv200/, 200, 300], ['GWM', /ora|funky/, 310, 420], ['KGM', /torres/, 460, 460], ['JEEP', /avenger/, 400, 400], ['HYUNDAI', /inster/, 330, 370],
    ['LEAPMOTOR', /./, 360, 430],
    ['XPENG', /g9/, 520, 570], ['XPENG', /g6/, 435, 570], ['RIVIAN', /./, 500, 650], ['LUCID', /./, 700, 900]
  ];
  function range(c) {
    var m = String(c.model || '').toLowerCase(), y = c.year || 2020;
    for (var i = 0; i < T.length; i++) {
      var t = T[i];
      if (t[0] === c.make && t[1].test(m) && (!t[4] || y >= t[4]) && (!t[5] || y <= t[5])) return [t[2], t[3]];
    }
    return null;
  }
  var EV = { range: range };
  root.EV = EV;
  if (typeof module !== 'undefined' && module.exports) module.exports = EV;
})(typeof window !== 'undefined' ? window : globalThis);
