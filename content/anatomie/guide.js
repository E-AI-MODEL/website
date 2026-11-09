// Korte, handmatig gecontroleerde uitleg voor veelgebruikte structuren.
// Aanvullend op de bestaande bronbeschrijvingen, niet een automatische
// afleiding van de Engelse naam. Geen verzonnen functie bij ontbrekende data.
const ITEMS = {
  'pleura': {
    name: 'Borstvlies (pleura)',
    function: 'Het longvlies (pleura visceralis) bedekt de long; het borstwandvlies (pleura parietalis) bekleedt de borstholte. Samen laten ze de longen met weinig wrijving bewegen.',
    location: 'De pleura visceralis volgt het longoppervlak en de longgroeven; de pleura parietalis bekleedt de borstwand, het middenrif en het mediastinum.',
    mechanism: 'De pleuraholte bevat een dunne vochtfilm. De druk in deze ruimte helpt de longen ontplooid te houden bij veranderingen in het borstkasvolume.'
  },
  'fascia lata': {
    name: 'Dijbeenfascie (fascia lata)',
    function: 'De fascia lata is de diepe fascie van het bovenbeen. Zij omgeeft de bovenbeenspieren en verdeelt ze via bindweefselschotten in spiercompartimenten.',
    location: 'Vanaf de bekkenrand rondom het bovenbeen; aan de buitenzijde verdikt tot de tractus iliotibialis, die aanhecht op het scheenbeen.',
    mechanism: 'De fascie vormt compartimenten en draagt spanning over. De tractus iliotibialis ontvangt onder meer trekkracht van de m. tensor fasciae latae en m. gluteus maximus.'
  },
  'diaphragm': {
    name: 'Middenrif',
    function: 'Het middenrif is de belangrijkste spier voor de inademing.',
    location: 'Tussen de borstholte en de buikholte, onder de longen.',
    mechanism: 'Bij aanspanning zakt het middenrif. De borstholte wordt groter en lucht stroomt de longen in.'
  },
  'kidney': {
    name: 'Nier',
    function: 'De nieren filteren het bloed, voeren afvalstoffen af via urine en helpen de hoeveelheid water en zouten in het lichaam regelen.',
    location: 'Achter in de buik, aan weerszijden van de wervelkolom.',
    mechanism: 'Kleine filtereenheden halen stoffen uit het bloed en nemen bruikbaar water en opgeloste stoffen deels weer op.'
  },
  'liver': {
    name: 'Lever',
    function: 'De lever verwerkt voedingsstoffen, slaat onder meer glycogeen op en maakt gal voor de vetvertering.',
    location: 'Rechtsboven in de buik, direct onder het middenrif.',
    mechanism: 'Via bloedvaten ontvangt de lever stoffen uit het spijsverteringsstelsel en verwerkt deze voor gebruik, opslag of afvoer.'
  },
  'stomach': {
    name: 'Maag',
    function: 'De maag bewaart en kneedt voedsel en mengt het met maagsap om de vertering te beginnen.',
    location: 'Linksboven in de buik, tussen slokdarm en dunne darm.',
    mechanism: 'Spieren in de maagwand kneden de voedselbrij; zuur en enzymen helpen bij de afbraak van eiwitten.'
  },
  'pancreas': {
    name: 'Alvleesklier',
    function: 'De alvleesklier maakt verteringsenzymen en hormonen zoals insuline en glucagon.',
    location: 'Diep in de bovenbuik, achter de maag.',
    mechanism: 'Het orgaan geeft enzymen af aan de dunne darm en hormonen aan het bloed.'
  },
  'femur': {
    name: 'Dijbeen',
    function: 'Het femur draagt lichaamsgewicht van het heupgewricht naar het kniegewricht en werkt als hefboom voor de spieren van heup en bovenbeen.',
    location: 'De femurkop vormt met het acetabulum het heupgewricht; distaal vormen de femurcondylen gewrichtsvlakken met tibia en patella.',
    mechanism: 'Via spieraanhechtingen aan onder meer trochanter major, trochanter minor en linea aspera worden bewegingen van heup en knie overgebracht.'
  },
  'tibia': {
    name: 'Scheenbeen',
    function: 'Het scheenbeen draagt een groot deel van het lichaamsgewicht van de knie naar de enkel.',
    location: 'Aan de binnenzijde en voorkant van het onderbeen.',
    mechanism: 'Het vormt een dragende verbinding tussen knie en enkel en geeft aanhechtingsplaatsen aan spieren.'
  },
  'sciatic nerve': {
    name: 'Heupzenuw',
    function: 'De nervus ischiadicus is de grootste zenuw van de plexus sacralis (wortels L4–S3) en voert motorische en sensibele zenuwvezels voor het been.',
    location: 'Verlaat het bekken meestal onder de m. piriformis, loopt achter door bil en bovenbeen en splitst in de n. tibialis en n. fibularis communis.',
    mechanism: 'Innerveert direct onder meer de hamstrings; via zijn eindtakken worden veel spieren en huidgebieden van onderbeen en voet bereikt.'
  },
  'ascending aorta': {
    name: 'Opstijgende aorta',
    function: 'Dit eerste deel van de aorta voert zuurstofrijk bloed vanuit de linkerkamer van het hart verder het lichaam in.',
    location: 'Direct boven de linkerkamer van het hart.',
    mechanism: 'Bij elke hartslag stroomt bloed via de aortaklep de aorta in.'
  },
  'abdominal aorta': {
    name: 'Buikaorta',
    function: 'De buikaorta verdeelt zuurstofrijk bloed over organen in de buik, het bekken en de benen.',
    location: 'Voor de wervelkolom in de buikholte.',
    mechanism: 'Via zijtakken stroomt bloed onder meer naar de nieren en de darmen.'
  },
  'thoracic aorta': {
    name: 'Borstaorta',
    function: 'Dit deel van de aorta vervoert zuurstofrijk bloed door de borstkas naar de buik.',
    location: 'In de borstholte, vóór en links van de wervelkolom.',
    mechanism: 'Kleinere zijtakken voorzien onder meer de borstwand en delen van de borstorganen van bloed.'
  },
  'long head of biceps brachii': {
  "name": "Lange kop van de tweehoofdige armspier",
  "function": "Draagt bij aan het buigen van de elleboog en het naar buiten draaien van de onderarm (supinatie); helpt ook de schouderkop te stabiliseren.",
  "location": "Ontspringt aan het tuberculum supraglenoidale van het schouderblad en loopt met zijn pees door de sulcus intertubercularis van de humerus.",
  "mechanism": "Verenigt zich met de korte kop tot de m. biceps brachii. De gezamenlijke eindpees hecht aan op de tuberositas radii."
},
  'short head of biceps brachii': {
  "name": "Korte kop van de tweehoofdige armspier",
  "function": "Helpt de elleboog te buigen en de onderarm te supineren; draagt ook bij aan het voorwaarts heffen van de bovenarm.",
  "location": "Ontspringt aan de processus coracoideus van het schouderblad, samen met de m. coracobrachialis.",
  "mechanism": "De korte en lange kop komen samen in de spierbuik; de eindpees hecht aan op de tuberositas radii en geeft een bicipitale aponeurose af."
},
  'anterior cruciate ligament': {
  "name": "Voorste kruisband",
  "function": "Beperkt het naar voren schuiven van het scheenbeen ten opzichte van het dijbeen en helpt de draaistabiliteit van de knie bewaken.",
  "location": "Binnen het kniegewricht, van het voorste intercondylaire gebied van de tibia naar de binnenzijde van de laterale femurcondyl.",
  "mechanism": "Komt onder spanning bij bepaalde schuif- en draaibelastingen; werkt samen met achterste kruisband, kapsel en omliggende spieren."
},
  'posterior cruciate ligament': {
  "name": "Achterste kruisband",
  "function": "Beperkt het naar achteren schuiven van de tibia ten opzichte van het femur en ondersteunt de stabiliteit van de knie.",
  "location": "Binnen het kniegewricht, van het achterste intercondylaire deel van de tibia naar de laterale zijde van de mediale femurcondyl.",
  "mechanism": "Werkt met de voorste kruisband en andere kapselbanden samen om de gewrichtsbeweging te begrenzen."
},
  'right main bronchus': {
  "name": "Rechter hoofdbronchus",
  "function": "Geleidt lucht vanuit de luchtpijp naar de rechterlong.",
  "location": "Vanaf de splitsing van de trachea (carina) naar de rechterlonghilus; gemiddeld breder, korter en steiler dan de linker hoofdbronchus.",
  "mechanism": "Vertakt zich in lobaire bronchi voor de drie longkwabben en daarna in segmentale bronchi."
},
  'left main bronchus': {
  "name": "Linker hoofdbronchus",
  "function": "Geleidt lucht vanuit de luchtpijp naar de linkerlong.",
  "location": "Vanaf de carina naar de linkerlonghilus; loopt doorgaans horizontaler en is langer dan de rechter hoofdbronchus.",
  "mechanism": "Vertakt zich in lobaire bronchi voor de twee longkwabben en vervolgens in segmentale bronchi."
},
  'facial artery': {
  "name": "Aangezichtsslagader",
  "function": "Voorziet grote delen van de oppervlakkige weke delen van het gezicht van zuurstofrijk bloed.",
  "location": "Ontspringt uit de a. carotis externa, loopt onder de onderkaak en buigt over de kaakrand vóór de kauwspier naar het gezicht.",
  "mechanism": "Geeft takken naar onder meer lippen en neus en verloopt vaak sterk kronkelig om gelaatsbewegingen te volgen."
},
  'pulmonary trunk': {
  "name": "Longslagaderstam",
  "function": "Voert zuurstofarm bloed vanuit de rechterkamer van het hart naar de longslagaders.",
  "location": "Begint boven de pulmonalisklep van de rechterkamer en splitst in een rechter en linker arteria pulmonalis.",
  "mechanism": "Het bloed stroomt via kleinere longslagadertakken naar de haarvaten rond de longblaasjes voor gaswisseling."
},
  'coronary sinus': {
  "name": "Sinus coronarius",
  "function": "Verzamelt veneus bloed uit een groot deel van de hartspier en voert het af naar de rechterboezem.",
  "location": "Aan de achterzijde van het hart, in de atrioventriculaire groeve.",
  "mechanism": "Ontvangt onder meer bloed uit de vena cardiaca magna en mondt uit in het rechteratrium."
},
  'posterior horn of spinal cord': {
  "name": "Achterhoorn van het ruggenmerg",
  "function": "Ontvangt en verwerkt sensibele informatie die via de achterwortels van de spinale zenuwen binnenkomt.",
  "location": "Dorsaal in de grijze stof van het ruggenmerg, links en rechts.",
  "mechanism": "Bevat neuronen en circuits die onder meer pijn-, temperatuur- en tastinformatie doorgeven of lokaal beïnvloeden."
},
  'urinary bladder': {
  "name": "Urineblaas",
  "function": "Slaat urine tijdelijk op en perst deze tijdens het plassen via de urinebuis naar buiten.",
  "location": "Laag in het bekken, achter het schaambeen.",
  "mechanism": "De m. detrusor trekt samen tijdens de urinelozing; de sluitmechanismen in de blaashals en urinebuis regelen het vasthouden en laten gaan."
},
  'patella': {
  "name": "Knieschijf",
  "function": "Vergroot de momentarm van de quadricepspees, waardoor de knie efficiënter kan worden gestrekt.",
  "location": "In de pees van de m. quadriceps femoris, vóór het kniegewricht; verbonden met de tuberositas tibiae via het ligamentum patellae.",
  "mechanism": "Glijdt tijdens kniebuiging en -strekking over de trochlea van het femur."
},
  'trachea': {
  "name": "Luchtpijp",
  "function": "Geleidt lucht tussen strottenhoofd en hoofdbronchiën en draagt via slijm en trilhaartjes bij aan de reiniging van ingeademde lucht.",
  "location": "Begint onder het ringkraakbeen, loopt vóór de slokdarm en splitst ter hoogte van de carina in beide hoofdbronchiën.",
  "mechanism": "C-vormige kraakbeenringen houden de buis open; het slijmvlies voert ingeademde deeltjes naar de keel."
},
  'ureter': {
  "name": "Urineleider",
  "function": "Vervoert urine vanuit het nierbekken naar de urineblaas.",
  "location": "Loopt retroperitoneaal van iedere nier naar de achterzijde van de blaas.",
  "mechanism": "Peristaltische samentrekkingen van glad spierweefsel duwen urine richting de blaas."
},
  'sternum': {
  "name": "Borstbeen",
  "function": "Vormt met de ribben een beschermende en dragende voorzijde van de borstkas.",
  "location": "Middenvoor op de borstkas, opgebouwd uit manubrium, corpus sterni en processus xiphoideus.",
  "mechanism": "Via ribkraakbeen verbinden meerdere ribben zich met het borstbeen; er hechten ook spieren aan."
},
  'scapula': {
  "name": "Schouderblad",
  "function": "Biedt aanhechting aan schouder- en rugspieren en vormt met de humeruskop het schoudergewricht.",
  "location": "Plat driehoekig bot achter op de borstkas, over ongeveer rib twee tot zeven.",
  "mechanism": "De cavitas glenoidalis ontvangt de humeruskop; beweging van scapula en clavicula vergroot de reikwijdte van de arm."
},
  'clavicle': {
  "name": "Sleutelbeen",
  "function": "Houdt de schoudergordel op afstand van de romp en draagt krachten van de arm over naar het axiale skelet.",
  "location": "Tussen het sternum en het acromion van de scapula.",
  "mechanism": "Vormt het sternoclaviculaire en acromioclaviculaire gewricht; aanhechting voor onder meer m. sternocleidomastoideus en m. pectoralis major."
},
  'hippocampus': {
  "name": "Hippocampus",
  "function": "Speelt een grote rol bij het vormen en consolideren van nieuwe episodische herinneringen en bij ruimtelijke navigatie.",
  "location": "Mediaal in de temporaalkwab, aan de vloer van de onderhoorn van de laterale hersenventrikel.",
  "mechanism": "Communiceert met onder meer de entorhinale cortex en andere onderdelen van het hippocampale geheugennetwerk."
},
};
export function anatomyGuide(base) {
  const key = String(base || '').replace(/\\.[lr]$/, '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ITEMS, key) ? ITEMS[key] : null;
}
