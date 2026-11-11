// Specifieke Nederlandstalige uitleg voor een eerste reeks modelstructuren.
// Nog niet onafhankelijk klinisch beoordeeld; geen automatische
// afleiding van de Engelse naam. Geen ingevulde functie bij ontbrekende data.
const ITEMS = {
  "vertebra c4": {
    "name": "Vierde halswervel (C4)",
    "function": "De vierde halswervel ondersteunt het hoofd en maakt beweging van de nek mogelijk. Samen met andere wervels beschermt hij het ruggenmerg.",
    "location": "In de hals, tussen de derde en vijfde halswervel.",
    "mechanism": "Gewrichten en tussenwervelschijven verbinden de wervels. Daardoor kan de nek bewegen zonder dat iedere wervel los staat.",
    "question": "Draai het model opzij. Waar loopt het ruggenmerg ten opzichte van deze wervel?"
  },
  "first rib": {
    "name": "Eerste rib",
    "function": "De eerste rib helpt de bovenkant van de borstkas te vormen en te beschermen.",
    "location": "Bovenaan de borstkas, verbonden met de eerste borstwervel en via kraakbeen met het borstbeen.",
    "mechanism": "De rib beweegt een beetje mee wanneer de borstkas tijdens het ademen groter en kleiner wordt.",
    "question": "Wat valt op aan de ligging van de eerste rib ten opzichte van de andere ribben?"
  },
  "intervertebral disc c4-c5": {
    "name": "Tussenwervelschijf C4-C5",
    "function": "Deze tussenwervelschijf vangt druk op en maakt kleine bewegingen tussen twee halswervels mogelijk.",
    "location": "Tussen de vierde en vijfde halswervel.",
    "mechanism": "Een stevige buitenring omgeeft een zachtere, geleiachtige binnenzijde. Samen verdelen ze de druk op de wervelkolom.",
    "question": "Zoek C4 en C5. Waarom ligt de tussenwervelschijf precies tussen deze botten?"
  },
  "nucleus pulposus c4-c5": {
    "name": "Zachte binnenzijde van tussenwervelschijf C4-C5",
    "function": "Dit zachte deel helpt druk op de tussenwervelschijf te verdelen.",
    "location": "Midden in de tussenwervelschijf tussen de vierde en vijfde halswervel.",
    "mechanism": "Bij belasting vervormt dit deel iets. De stevigere buitenring houdt het binnen de schijf.",
    "question": "Vergelijk de binnenzijde met de buitenring. Waarom bestaan ze uit verschillend weefsel?"
  },
  "tibialis anterior muscle": {
    "name": "Voorste scheenbeenspier",
    "function": "Deze spier tilt de voorvoet op en helpt de voet naar binnen te draaien.",
    "location": "Aan de voorkant van het onderbeen, naast het scheenbeen. De pees loopt naar de binnenzijde van de voet.",
    "mechanism": "Bij samentrekken trekt de spier via zijn pees aan de voet, waardoor de tenen omhoog bewegen.",
    "question": "Waarom heb je deze beweging nodig wanneer je loopt?"
  },
  "lateral meniscus": {
    "name": "Buitenmeniscus",
    "function": "De buitenmeniscus verdeelt druk in de knie en helpt het gewricht stabiel te houden.",
    "location": "Aan de buitenzijde van het kniegewricht, tussen dijbeen en scheenbeen.",
    "mechanism": "Het halvemaanvormige kraakbeen vergroot het contact tussen de botten en beweegt een beetje mee bij het buigen.",
    "question": "Vergelijk de buitenmeniscus met de binnenmeniscus. Wat is hetzelfde aan hun ligging?"
  },
  "medial meniscus": {
    "name": "Binnenmeniscus",
    "function": "De binnenmeniscus verdeelt druk in de knie en draagt bij aan de stabiliteit.",
    "location": "Aan de binnenzijde van het kniegewricht, tussen dijbeen en scheenbeen.",
    "mechanism": "Het stevige, veerkrachtige kraakbeen helpt de belasting over een groter oppervlak te verdelen.",
    "question": "Waar liggen de menisci ten opzichte van de kruisbanden?"
  },
  "femoral artery": {
    "name": "Dijbeenslagader",
    "function": "De dijbeenslagader voert zuurstofrijk bloed naar het bovenbeen en via vertakkingen verder naar het been.",
    "location": "Loopt vanuit de lies door het bovenbeen richting de knie.",
    "mechanism": "Door de druk die het hart opbouwt stroomt bloed via deze slagader naar kleinere bloedvaten.",
    "question": "Volg de slagader vanaf de lies. Waarom vertakt hij zich in steeds kleinere vaten?"
  },
  "superior vena cava": {
    "name": "Bovenste holle ader",
    "function": "De bovenste holle ader brengt zuurstofarm bloed uit het hoofd, de hals en de armen terug naar het hart.",
    "location": "Boven de rechterboezem van het hart.",
    "mechanism": "Meerdere grote aders komen hierin samen. Het bloed stroomt daarna de rechterboezem in.",
    "question": "Volg deze ader naar het hart. In welke boezem komt het bloed terecht?"
  },
  "left atrium": {
    "name": "Linkerboezem",
    "function": "De linkerboezem ontvangt zuurstofrijk bloed uit de longen.",
    "location": "Boven de linkerhartkamer, aan de achterzijde van het hart.",
    "mechanism": "Via de longaders komt bloed binnen. De boezem geeft het vervolgens door aan de linkerkamer.",
    "question": "Welke bloedvaten komen uit op de linkerboezem?"
  },
  "right atrium": {
    "name": "Rechterboezem",
    "function": "De rechterboezem ontvangt zuurstofarm bloed uit het lichaam.",
    "location": "Boven de rechterhartkamer, aan de rechterkant van het hart.",
    "mechanism": "Bloed uit de holle aders stroomt binnen en gaat via een hartklep naar de rechterkamer.",
    "question": "Vergelijk de binnenkomende bloedvaten van beide boezems. Welk verschil zie je?"
  },
  "optic chiasm": {
    "name": "Kruising van de oogzenuwen",
    "function": "Bij deze kruising wisselt een deel van de zenuwvezels uit beide ogen van kant.",
    "location": "Aan de onderzijde van de hersenen, achter de ogen.",
    "mechanism": "Vezels uit de binnenste helft van beide netvliezen kruisen. Daardoor kan informatie uit hetzelfde deel van het gezichtsveld samen worden verwerkt.",
    "question": "Volg de twee oogzenuwen tot aan hun kruising. Waar gaan ze daarna naartoe?"
  },
  "cornea": {
    "name": "Hoornvlies",
    "function": "Het hoornvlies beschermt de voorkant van het oog en buigt invallend licht af.",
    "location": "Als doorzichtige laag voor de pupil en de iris.",
    "mechanism": "Door de gebogen vorm wordt het licht al sterk gebroken voordat het de ooglens bereikt.",
    "question": "Waarom is het handig dat het hoornvlies doorzichtig is?"
  },
  "retina": {
    "name": "Netvlies",
    "function": "Het netvlies zet licht om in signalen die de hersenen kunnen verwerken.",
    "location": "Als dunne laag aan de binnenzijde van de achterkant van het oog.",
    "mechanism": "Staafjes en kegeltjes reageren op licht. Via zenuwcellen worden signalen naar de oogzenuw doorgegeven.",
    "question": "Volg de weg van het licht tot aan het netvlies. Welke onderdelen passeert het?"
  },
  "central sulcus": {
    "name": "Centrale hersengroeve",
    "function": "De centrale groeve is een duidelijke grens tussen twee gebieden van de hersenschors.",
    "location": "Aan de buitenzijde van beide grotehersenhelften, tussen voorhoofdskwab en wandbeenkwab.",
    "mechanism": "Vlak vóór de groeve ligt een gebied dat belangrijk is voor bewegen. Vlak erachter ligt een gebied dat lichaamsgevoel verwerkt.",
    "question": "Zoek de groeve. Welke hersengebieden liggen er direct voor en achter?"
  },
  "corpus callosum": {
    "name": "Hersenbalk",
    "function": "De hersenbalk verbindt de linker- en rechterhersenhelft zodat informatie tussen beide kan worden doorgegeven.",
    "location": "Diep in de hersenen, boven de hersenkamers.",
    "mechanism": "Miljoenen zenuwvezels lopen van de ene hersenhelft naar de andere.",
    "question": "Bekijk de hersenen van boven en daarna van opzij. Waarom is de hersenbalk van buiten nauwelijks zichtbaar?"
  },
  "spleen": {
    "name": "Milt",
    "function": "De milt helpt bij het opruimen van oude bloedcellen en speelt een rol bij de afweer.",
    "location": "Linksboven in de buik, achter de maag en onder het middenrif.",
    "mechanism": "Bloed stroomt door de milt, waar bepaalde cellen het controleren en oude bloedcellen kunnen opruimen.",
    "question": "Zoek de milt. Welke andere organen liggen er vlakbij?"
  },
  "pancreatic duct": {
    "name": "Afvoergang van de alvleesklier",
    "function": "Deze afvoergang brengt alvleeskliersap met verteringsenzymen naar de dunne darm.",
    "location": "Loopt door de alvleesklier naar de twaalfvingerige darm.",
    "mechanism": "De enzymen helpen voedingsstoffen in de dunne darm af te breken.",
    "question": "Volg de afvoergang. Waarom komt het alvleeskliersap juist in de dunne darm terecht?"
  },
  "duodenum": {
    "name": "Twaalfvingerige darm",
    "function": "Het eerste deel van de dunne darm mengt voedsel uit de maag met gal en alvleeskliersap.",
    "location": "Direct na de maag, in een bocht om de kop van de alvleesklier.",
    "mechanism": "De sappen helpen bij de vertering van vetten, eiwitten en koolhydraten.",
    "question": "Welke afvoerbuizen komen uit bij de twaalfvingerige darm?"
  },
  "renal pelvis": {
    "name": "Nierbekken",
    "function": "Het nierbekken verzamelt urine voordat die naar de urineleider stroomt.",
    "location": "Binnen in de nier, aan de kant waar de urineleider vertrekt.",
    "mechanism": "Urine uit de nierkelken komt samen in het nierbekken en stroomt verder door de urineleider.",
    "question": "Volg de urine van het nierbekken naar de blaas. Welke structuur verbindt ze?"
  },
  "ulnar artery": {
    "name": "Ellepijpsslagader",
    "function": "Deze slagader brengt bloed naar de onderarm en de hand.",
    "location": "Loopt vooral aan de pinkzijde van de onderarm richting de handpalm.",
    "mechanism": "Hij geeft vertakkingen af en helpt samen met de spaakbeenslagader de hand van bloed te voorzien.",
    "question": "Vergelijk de ellepijpsslagader met de spaakbeenslagader. Aan welke kant van de onderarm loopt elk vat?"
  },
  "femoral vein": {
    "name": "Dijbeenader",
    "function": "Deze ader voert bloed uit het been terug in de richting van het hart.",
    "location": "Loopt door het bovenbeen naar de lies, dicht bij de dijbeenslagader.",
    "mechanism": "Spierbewegingen en kleppen in de aders helpen het bloed tegen de zwaartekracht in terug te stromen.",
    "question": "Volg de ader vanaf het bovenbeen naar het bekken. In welke richting stroomt het bloed?"
  },
  "anterior axillary nodes": {
    "name": "Voorste oksellymfeklieren",
    "function": "Deze lymfeklieren filteren lymfevocht en ondersteunen de afweer.",
    "location": "Aan de voorzijde van de oksel, bij de borstspieren.",
    "mechanism": "Lymfevocht stroomt langs afweercellen in de lymfeklieren. Die kunnen ziekteverwekkers herkennen.",
    "question": "Waar liggen deze lymfeklieren ten opzichte van de bloedvaten in de oksel?"
  },
  "basilar artery": {
    "name": "Basilaire slagader",
    "function": "De basilaire slagader voert bloed naar delen van de hersenstam en kleine hersenen.",
    "location": "Aan de voorkant van de hersenbrug.",
    "mechanism": "De twee wervelslagaders komen samen en vormen deze slagader, die verder vertakt.",
    "question": "Volg de twee wervelslagaders. Waar komen ze bij elkaar?"
  },
  'pleura': {
    name: 'Borstvlies (pleura)',
    function: 'Twee dunne vliezen liggen rond de longen: één direct op de long en één tegen de binnenkant van de borstkas. Ze kunnen soepel langs elkaar bewegen bij het ademen.',
    location: 'De pleura visceralis volgt het longoppervlak en de longgroeven; de pleura parietalis bekleedt de borstwand, het middenrif en het mediastinum.',
    mechanism: 'De pleuraholte bevat een dunne vochtfilm. De druk in deze ruimte helpt de longen ontplooid te houden bij veranderingen in het borstkasvolume.'
  },
  'fascia lata': {
    name: 'Dijbeenfascie (fascia lata)',
    function: 'De fascia lata is een stevig bindweefselvlies rond de spieren van het bovenbeen. Het houdt spiergroepen bij elkaar en scheidt ze van elkaar.',
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
    function: 'Het dijbeen draagt veel lichaamsgewicht en verbindt de heup met de knie. Spieren trekken eraan om het been te laten bewegen.',
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
    function: 'De grote beenzenuw vervoert signalen tussen het ruggenmerg en delen van het been. Deze signalen sturen spieren aan en geven gevoel door.',
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
  "function": "Dit deel van de biceps helpt de elleboog te buigen en de onderarm zo te draaien dat de handpalm omhoog wijst. Het helpt ook de schouder te stabiliseren.",
  "location": "Ontspringt aan het tuberculum supraglenoidale van het schouderblad en loopt met zijn pees door de sulcus intertubercularis van de humerus.",
  "mechanism": "Verenigt zich met de korte kop tot de m. biceps brachii. De gezamenlijke eindpees hecht aan op de tuberositas radii."
},
  'short head of biceps brachii': {
  "name": "Korte kop van de tweehoofdige armspier",
  "function": "Dit deel van de biceps helpt de elleboog te buigen en de handpalm omhoog te draaien. Het helpt ook de bovenarm naar voren te bewegen.",
  "location": "Ontspringt aan de processus coracoideus van het schouderblad, samen met de m. coracobrachialis.",
  "mechanism": "De korte en lange kop komen samen in de spierbuik; de eindpees hecht aan op de tuberositas radii en geeft een bicipitale aponeurose af."
},
  'anterior cruciate ligament': {
  "name": "Voorste kruisband",
  "function": "Beperkt het naar voren schuiven van het scheenbeen ten opzichte van het dijbeen en helpt de draaistabiliteit van de knie bewaken.",
  "location": "Binnen het kniegewricht, van het voorste intercondylaire gebied van de tibia naar de binnenzijde van de laterale femurcondyl.",
  "mechanism": "Komt onder spanning bij bepaalde schuif- en draaibelastingen; werkt samen met achterste kruisband, kapsel en omliggende spieren.",
  "question": "Bekijk de richting van de band. Welke beweging van het scheenbeen helpt hij tegen te houden?"
},
  'posterior cruciate ligament': {
  "name": "Achterste kruisband",
  "function": "De achterste kruisband helpt voorkomen dat het scheenbeen te ver naar achteren schuift ten opzichte van het dijbeen.",
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
  "function": "Dit deel van het ruggenmerg ontvangt signalen over gevoel, zoals aanraking, pijn en temperatuur.",
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
  "function": "De knieschijf beschermt de voorkant van de knie en zorgt dat de bovenbeenspieren het onderbeen gemakkelijker kunnen strekken.",
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
  'body of sternum': {
    name: 'Middendeel van het borstbeen',
    function: 'Dit deel vormt de stevige voorkant van de borstkas. Verschillende ribben zijn er via kraakbeen mee verbonden.',
    location: 'Middenvoor op de borstkas, tussen het bovenste deel van het borstbeen en het zwaardvormig aanhangsel.',
    mechanism: 'De verbindingen met de ribben laten de borstkas bij het ademen een beetje bewegen.',
    question: 'Zoek de ribkraakbenen die op het middendeel aansluiten. Waarom is er kraakbeen tussen rib en borstbeen?'
  },
  'scapula': {
  "name": "Schouderblad",
  "function": "Het schouderblad biedt aanhechting aan spieren en vormt samen met het opperarmbeen het schoudergewricht.",
  "location": "Plat driehoekig bot achter op de borstkas, over ongeveer rib twee tot zeven.",
  "mechanism": "De cavitas glenoidalis ontvangt de humeruskop; beweging van scapula en clavicula vergroot de reikwijdte van de arm."
},
  'clavicle': {
  "name": "Sleutelbeen",
  "function": "Het sleutelbeen houdt de schouder op afstand van de borstkas en geeft krachten van de arm door aan de romp.",
  "location": "Tussen het sternum en het acromion van de scapula.",
  "mechanism": "Vormt het sternoclaviculaire en acromioclaviculaire gewricht; aanhechting voor onder meer m. sternocleidomastoideus en m. pectoralis major."
},

  'articular capsule of knee joint': {
    name: 'Gewrichtskapsel van de knie',
    function: 'Het gewrichtskapsel omsluit het kniegewricht. Het helpt het gewricht bij elkaar te houden.',
    location: 'Rond het kniegewricht, tussen het dijbeen en het scheenbeen.',
    mechanism: 'De binnenkant maakt gewrichtsvloeistof. Die zorgt ervoor dat de gewrichtsvlakken soepel langs elkaar bewegen.',
    question: 'Waarom is een soepel gewrichtskapsel handig bij het buigen van je knie?'
  },
  'articular capsule of glenohumeral joint': {
    name: 'Gewrichtskapsel van de schouder',
    function: 'Het gewrichtskapsel omsluit het schoudergewricht en helpt de gewrichtskop op zijn plaats te houden.',
    location: 'Rond de kop van het opperarmbeen en de gewrichtskom van het schouderblad.',
    mechanism: 'Het kapsel is ruim en laat veel bewegingsvrijheid toe. De spieren rondom de schouder helpen het gewricht stabiel te houden.',
    question: 'Welke bewegingen kan de schouder maken die bij de knie niet mogelijk zijn?'
  },
  'articular capsules of metatarsophalangeal joints': {
    name: 'Gewrichtskapsels van de teengewrichten',
    function: 'Deze kapsels omsluiten de gewrichten tussen de middenvoetsbeentjes en de tenen.',
    location: 'Aan de basis van de tenen.',
    mechanism: 'Ze helpen de gewrichten bij elkaar te houden en laten de tenen buigen en strekken.',
    question: 'Bekijk de ligging. Waarom moeten je tenen kunnen buigen bij het lopen?'
  },
  'aortic arch': {
    name: 'Aortaboog',
    function: 'De aortaboog vervoert zuurstofrijk bloed vanuit het hart naar de rest van het lichaam.',
    location: 'Boven het hart, tussen de opstijgende en de dalende aorta.',
    mechanism: 'Vanuit de boog vertrekken grote slagaders naar onder meer het hoofd en de armen.',
    question: 'Volg de aortaboog. Welke delen van het lichaam krijgen via de aftakkingen bloed?'
  },
  'left ventricle': {
    name: 'Linkerhartkamer',
    function: 'De linkerhartkamer pompt zuurstofrijk bloed via de aorta naar het lichaam.',
    location: 'Aan de linkerzijde en onderkant van het hart.',
    mechanism: 'De spierwand trekt krachtig samen en duwt het bloed door de aortaklep.',
    question: 'Waarom is de spierwand van de linkerkamer dikker dan die van de rechterkamer?'
  },
  'right ventricle': {
    name: 'Rechterhartkamer',
    function: 'De rechterhartkamer pompt zuurstofarm bloed naar de longen.',
    location: 'Voornamelijk aan de voorzijde van het hart.',
    mechanism: 'Bij samentrekken stroomt het bloed via de longslagader richting de longen.',
    question: 'Volg de uitgaande slagader. Waar gaat het bloed vanuit de rechterkamer naartoe?'
  },
  'optic nerve (ii)': {
    name: 'Oogzenuw',
    function: 'De oogzenuw geeft signalen van het netvlies door aan de hersenen.',
    location: 'Vanuit de achterkant van het oog naar de kruising van de oogzenuwen.',
    mechanism: 'Zenuwvezels vervoeren elektrische signalen. De hersenen verwerken de informatie tot wat je ziet.',
    question: 'Volg de oogzenuw vanaf het oog. Waarom is deze verbinding nodig om te kunnen zien?'
  },

  'hippocampus': {
  "name": "Hippocampus",
  "function": "De hippocampus helpt nieuwe herinneringen vast te leggen. Hij speelt ook een rol bij het onthouden van plaatsen en routes.",
  "location": "Mediaal in de temporaalkwab, aan de vloer van de onderhoorn van de laterale hersenventrikel.",
  "mechanism": "Communiceert met onder meer de entorhinale cortex en andere onderdelen van het hippocampale geheugennetwerk."
},
};
export function anatomyGuide(base) {
  const key = String(base || '').replace(/\.[lr]$/, '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ITEMS, key) ? ITEMS[key] : null;
}
