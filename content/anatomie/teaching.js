// Typegebonden uitleg voor de resterende 3D-onderdelen, zonder een
// onbewezen functie aan een specifieke anatomische structuur toe te schrijven.
// De 61 inhoudelijk beschreven onderdelen staan afzonderlijk in eaiGuide.js.

const UNCLEAR = new Set([
  '????????', '?x', "central canal'", 'lat_fis-ant-horizont',
  'lat_fis-ant-vertical', 'lat_fis-post', 'sulcus interm_prim-jensen'
]);

const SYSTEMS = {
  skeletal: 'skelet',
  joints: 'gewrichten en banden',
  muscular: 'spieren en bindweefsel',
  cardiovascular: 'hart en bloedvaten',
  lymphatic: 'lymfestelsel',
  nervous: 'zenuwstelsel en zintuigen',
  visceral: 'organen'
};

// Functies gelden voor een herkenbare soort structuur, niet voor ieder
// individueel onderdeel. De concrete ligging bekijk je in het model.
const TYPES = {
  bot: {
    kind: 'Bot of botonderdeel',
    general: 'Botweefsel geeft steun en vorm. Samen met gewrichten en spieren maakt het beweging mogelijk. Sommige botten beschermen ook kwetsbare organen.',
    question: 'Draai het model. Met welke botten of gewrichten staat dit onderdeel in contact?'
  },
  rib: {
    kind: 'Rib of ribonderdeel',
    general: 'Ribben vormen met het borstbeen en de borstwervels de borstkas. Die beschermt organen en beweegt mee bij de ademhaling.',
    question: 'Bekijk deze rib van opzij. Hoe sluit hij aan op de wervelkolom en de voorkant van de borstkas?'
  },
  wervel: {
    kind: 'Wervel of wervelonderdeel',
    general: 'Wervels geven de wervelkolom stevigheid. De openingen in de wervels vormen samen een kanaal rond het ruggenmerg.',
    question: 'Vergelijk deze wervel met die erboven en eronder. Wat blijft gelijk en wat verandert?'
  },
  kraakbeen: {
    kind: 'Kraakbeen',
    general: 'Kraakbeen is stevig maar kan iets vervormen. Het kan structuren ondersteunen, vorm geven of een gewricht soepel laten bewegen.',
    question: 'Vergelijk de vorm van dit kraakbeen met het bot of weefsel ernaast.'
  },
  tand: {
    kind: 'Tand of tandonderdeel',
    general: 'Tanden helpen voedsel afbijten en fijnmaken. Hun vorm past bij de plaats in het gebit.',
    question: 'Zoek de aangrenzende tanden. Waarin verschilt de vorm van dit onderdeel?'
  },
  holte: {
    kind: 'Lichaamsholte',
    general: 'Dit is een ruimte in of tussen anatomische structuren. De precieze functie verschilt per holte en wordt hier niet uit de naam afgeleid.',
    question: 'Bekijk de ruimte en de begrenzing ervan. Welke structuren liggen eromheen?'
  },
  band: {
    kind: 'Band (ligament)',
    general: 'Een gewrichtsband bestaat uit stevig bindweefsel. Banden verbinden doorgaans botten en helpen ongewenste bewegingen te begrenzen.',
    question: 'Volg de band van het ene aanhechtingspunt naar het andere. Welke beweging zou hem op spanning zetten?'
  },
  kapsel: {
    kind: 'Gewrichtskapsel',
    general: 'Een gewrichtskapsel omsluit een gewricht. De stevige buitenlaag biedt steun; de binnenlaag helpt gewrichtsvloeistof te maken.',
    question: 'Welk gewricht ligt binnen dit kapsel? Kijk wat er gebeurt wanneer je andere onderdelen verbergt.'
  },
  schijf: {
    kind: 'Gewrichtsschijf of tussenwervelschijf',
    general: 'Een schijf van vezelig kraakbeen kan druk verdelen, dempen en de aansluiting tussen gewrichtsvlakken verbeteren.',
    question: 'Zoek de botdelen aan weerszijden. Waarom is een veerkrachtige schijf op deze plek nuttig?'
  },
  nucleus: {
    kind: 'Binnenzijde van een tussenwervelschijf',
    general: 'De geleiachtige binnenzijde van een tussenwervelschijf helpt druk te verdelen. Een stevige buitenring houdt het weefsel op zijn plaats.',
    question: 'Waar zit dit deel binnen de schijf? Zoek daarna de omliggende wervels.'
  },
  meniscus: {
    kind: 'Meniscus',
    general: 'Een meniscus bestaat uit vezelig kraakbeen. In de knie helpt dit weefsel druk te verdelen en het contact tussen de botten te vergroten.',
    question: 'Bekijk de vorm van de meniscus en de botdelen erboven en eronder.'
  },
  membraan: {
    kind: 'Bindweefselvlies',
    general: 'Een bindweefselvlies kan onderdelen scheiden, bedekken of met elkaar verbinden. De precieze taak hangt af van de plaats.',
    question: 'Welk gebied wordt door dit vlies afgedekt of van een ander gebied gescheiden?'
  },
  slijmbeurs: {
    kind: 'Slijmbeurs',
    general: 'Een slijmbeurs is een met vocht gevuld zakje. Het vermindert wrijving tussen bewegende weefsels, bijvoorbeeld tussen een pees en bot.',
    question: 'Zoek de slijmbeurs en de twee structuren ertussen. Waarom kan hier wrijving ontstaan?'
  },
  pees: {
    kind: 'Pees of peesplaat',
    general: 'Een pees bestaat uit sterk bindweefsel. Hij draagt de trekkracht van een spier over op zijn aanhechting.',
    question: 'Probeer de pees te volgen. Welke spier en welke andere structuur verbindt hij?'
  },
  peesschede: {
    kind: 'Peesschede of steunband',
    general: 'Peesschedes en steunbanden begeleiden pezen op plaatsen waar die langs andere structuren bewegen. Ze helpen pezen op hun plek te houden.',
    question: 'Welke pezen lopen langs of door dit onderdeel?'
  },
  fascie: {
    kind: 'Fascie (bindweefsel)',
    general: 'Fascie is bindweefsel dat spieren en andere structuren omhult of van elkaar scheidt. Het helpt krachten te verdelen.',
    question: 'Bekijk of dit bindweefsel om een spier heen ligt of tussen meerdere spieren doorloopt.'
  },
  spier: {
    kind: 'Skeletspier of spieronderdeel',
    general: 'Skeletspieren trekken samen wanneer zij een signaal van een zenuw ontvangen. Via hun aanhechtingen kunnen ze een lichaamsdeel verplaatsen of stabiliseren.',
    question: 'Volg de spier. Wat lijken het begin en het einde van de spier te zijn? Welke beweging zou de spier kunnen maken?'
  },
  slagader: {
    kind: 'Slagader of slagadertak',
    general: 'Slagaders vervoeren bloed van het hart af. Via kleinere vertakkingen bereikt het bloed de organen en weefsels.',
    question: 'Volg deze slagader zo ver mogelijk. Uit welk groter bloedvat komt hij voort?'
  },
  ader: {
    kind: 'Ader of adertak',
    general: 'Aders vervoeren bloed in de richting van het hart. Kleinere aders komen samen in grotere bloedvaten.',
    question: 'Volg deze ader terug. Bij welke grotere ader sluit hij aan?'
  },
  hartklep: {
    kind: 'Hartklep of klepblad',
    general: 'Hartkleppen openen en sluiten door drukverschillen. Zo helpen ze te voorkomen dat bloed terugstroomt.',
    question: 'Waar ligt deze klep ten opzichte van de hartkamers, boezems en grote bloedvaten?'
  },
  hartspier: {
    kind: 'Spieronderdeel van het hart',
    general: 'Spierweefsel in het hart helpt bloed door de bloedsomloop te verplaatsen. Sommige kleine spieren ondersteunen de werking van de hartkleppen.',
    question: 'Bekijk de verbinding met de hartwand en de kleppen. Waar ligt dit onderdeel in het hart?'
  },
  bloedvat: {
    kind: 'Onderdeel van de bloedsomloop',
    general: 'Het hart en de bloedvaten vervoeren bloed door het lichaam. Deze atlas toont de ligging van het gekozen onderdeel, niet de bloedstroom zelf.',
    question: 'Welke bloedvaten of hartdelen liggen direct naast dit onderdeel?'
  },
  afweerorgaan: {
    kind: 'Orgaan van het afweersysteem',
    general: 'De milt, zwezerik en amandelen zijn betrokken bij de afweer, maar hebben verschillende taken. Dit is geen lymfeklier; de werking van het gekozen orgaan vraagt afzonderlijke uitleg.',
    question: 'Bekijk de ligging van dit orgaan. Welke andere organen en bloedvaten liggen eromheen?'
  },
  lymfeklier: {
    kind: 'Lymfeklier',
    general: 'Lymfeklieren filteren lymfevocht. Afweercellen kunnen er ziekteverwekkers herkennen en erop reageren.',
    question: 'Zoek de groep lymfeklieren. Waar liggen ze ten opzichte van de bloedvaten en organen?'
  },
  lymfevat: {
    kind: 'Lymfevat of lymfebuis',
    general: 'Lymfevaten brengen vocht uit de weefsels terug naar de bloedsomloop. Onderweg stroomt het langs lymfeklieren.',
    question: 'Volg het verloop van dit lymfevat. Welke klieren of andere vaten liggen erlangs?'
  },
  zenuw: {
    kind: 'Zenuw of zenuwtak',
    general: 'Zenuwen vervoeren signalen tussen het centrale zenuwstelsel en andere delen van het lichaam. Sommige signalen sturen spieren aan; andere geven informatie van zintuigen door.',
    question: 'Volg het verloop van deze zenuw. Naar welk lichaamsdeel loopt hij?'
  },
  zenuwvlies: {
    kind: 'Beschermend vlies rond zenuwweefsel',
    general: 'De hersenvliezen en vliezen rond het ruggenmerg omgeven kwetsbaar zenuwweefsel. Sommige vormen stevige scheidingen in de schedel.',
    question: 'Bekijk dit vlies vanuit meerdere richtingen. Welk deel van de hersenen of het ruggenmerg beschermt het?'
  },
  zenuwbaan: {
    kind: 'Zenuwbaan',
    general: 'Zenuwbanen bestaan uit bundels zenuwvezels. Ze dragen informatie tussen gebieden van de hersenen en het ruggenmerg.',
    question: 'Waar begint de zichtbare baan en in welke richting loopt hij door het model?'
  },
  hersengroeve: {
    kind: 'Groeve in de hersenen',
    general: 'Groeven scheiden zichtbare windingen van de hersenschors. Ze helpen gebieden van de hersenen aan hun ligging te herkennen.',
    question: 'Volg de groeve. Welke windingen liggen aan weerszijden?'
  },
  hersenwinding: {
    kind: 'Winding in de hersenen',
    general: 'Windingen vormen het geplooide oppervlak van de hersenschors. De groeven ertussen helpen bij het herkennen van gebieden.',
    question: 'Draai de hersenen en zoek de groeven die deze winding begrenzen.'
  },
  zenuwknoop: {
    kind: 'Zenuwknoop of zenuwcelgroep',
    general: 'Hier liggen veel cellichamen van zenuwcellen bij elkaar. De precieze verwerking van signalen hangt af van de betreffende zenuwcelgroep.',
    question: 'Zoek dit gebied en vergelijk zijn ligging met de zenuwbanen in de buurt.'
  },
  zintuig: {
    kind: 'Onderdeel van een zintuig',
    general: 'Een zintuig heeft structuren die prikkels opvangen, begeleiden of verwerken. Niet ieder onderdeel doet zelf aan waarneming.',
    question: 'Bekijk dit onderdeel in het geheel van het oog of oor. Welke structuren liggen ervoor en erachter?'
  },
  hersendeel: {
    kind: 'Onderdeel van hersenen of ruggenmerg',
    general: 'De hersenen en het ruggenmerg bestaan uit verschillende gebieden en zenuwverbindingen. Hun specifieke taken kun je niet alleen uit de vorm afleiden.',
    question: 'Bekijk de ligging van dit deel. Welke andere gebieden of banen liggen direct ernaast?'
  },
  bronchus: {
    kind: 'Luchtwegtak',
    general: 'Bronchiën geleiden ingeademde en uitgeademde lucht door de longen. Ze vertakken zich steeds verder in kleinere luchtwegen.',
    question: 'Volg de luchtweg vanuit de luchtpijp. In welk deel van de long komt deze tak uit?'
  },
  afvoerbuis: {
    kind: 'Afvoergang',
    general: 'Een afvoergang vervoert vocht uit een klier of orgaan naar een andere plek. De inhoud verschilt per orgaan.',
    question: 'Volg de afvoergang en zoek waar hij begint en waar hij uitmondt.'
  },
  klier: {
    kind: 'Klier of klieronderdeel',
    general: 'Klieren maken stoffen aan die het lichaam gebruikt. Sommige geven stoffen af aan het bloed; andere voeren die via een buis af.',
    question: 'Zoek waar deze klier ligt en of er een afvoergang of bloedvat zichtbaar is.'
  },
  darm: {
    kind: 'Onderdeel van het spijsverteringsstelsel',
    general: 'De organen van het spijsverteringsstelsel verplaatsen en verwerken voedsel. Opname van voedingsstoffen vindt vooral in de dunne darm plaats.',
    question: 'Volg het verloop van dit onderdeel. Waar sluit het aan op de rest van het spijsverteringsstelsel?'
  },
  orgaan: {
    kind: 'Orgaan of orgaanonderdeel',
    general: 'Organen bestaan uit verschillende weefsels die samen een taak uitvoeren. Een deel van een orgaan heeft niet altijd dezelfde functie als het hele orgaan.',
    question: 'Zoek dit onderdeel in het volledige orgaan. Welke omliggende structuren zijn zichtbaar?'
  },
  onbekend: {
    kind: 'Anatomische structuur',
    general: 'De naam en de plaats in het model geven nog niet genoeg informatie om een specifieke functie betrouwbaar vast te stellen.',
    question: 'Draai het 3D-model en onderzoek vorm, ligging en aangrenzende structuren. Wat valt je op?'
  }
};

function matches(name, pattern) {
  return pattern.test(name);
}

function classFor(name, system) {
  if (system === 'skeletal') {
    if (matches(name, /\b(cartilage|cartilages)\b/)) return 'kraakbeen';
    if (matches(name, /\b(rib|costal)\b/)) return 'rib';
    if (matches(name, /\b(vertebra|vertebral)\b/)) return 'wervel';
    if (matches(name, /\b(tooth|molar|premolar|incisor|canine)\b/)) return 'tand';
    if (matches(name, /\b(sinus|cavity|meatus)\b/)) return 'holte';
    return 'bot';
  }
  if (system === 'joints') {
    if (name.startsWith('nucleus pulposus')) return 'nucleus';
    if (matches(name, /\b(meniscus|menisci)\b/)) return 'meniscus';
    if (matches(name, /\b(capsule|capsules)\b/)) return 'kapsel';
    if (matches(name, /\b(disc|symphysis)\b/)) return 'schijf';
    if (matches(name, /\b(membrane|fascia)\b/)) return 'membraan';
    if (matches(name, /\b(cartilage|labrum)\b/)) return 'kraakbeen';
    return 'band';
  }
  if (system === 'muscular') {
    if (matches(name, /\b(bursa|bursae)\b/)) return 'slijmbeurs';
    if (matches(name, /\b(tendon sheath|tendon sheaths|retinaculum|synovial sheath)\b/)) return 'peesschede';
    if (matches(name, /\b(tendon|aponeurosis|tendinous)\b/)) return 'pees';
    if (matches(name, /\b(fascia|septum|septal|tract)\b/)) return 'fascie';
    return 'spier';
  }
  if (system === 'cardiovascular') {
    if (matches(name, /\b(leaflet|valve)\b/)) return 'hartklep';
    if (matches(name, /\b(papillary muscle)\b/)) return 'hartspier';
    if (matches(name, /\b(vein|veins|venous|vena cava|sinus|plexus)\b/)) return 'ader';
    if (matches(name, /\b(artery|arteries|arterial|aorta|trunk)\b/)) return 'slagader';
    return 'bloedvat';
  }
  if (system === 'lymphatic') {
    if (matches(name, /\b(spleen|thymus|tonsil)\b/)) return 'afweerorgaan';
    if (matches(name, /\b(duct|vessel|trunk)\b/)) return 'lymfevat';
    return 'lymfeklier';
  }
  if (system === 'nervous') {
    if (matches(name, /\b(dura|falx|tentorium|meningeal|meninges)\b/)) return 'zenuwvlies';
    if (matches(name, /\b(eyeball|retina|cornea|iris|lens|lacrimal|sclera|cochlea|vestibule|tympanic|vitreous|zonular)\b/)) return 'zintuig';
    if (matches(name, /\b(nerve|nerves|plexus|root|branch)\b/)) return 'zenuw';
    if (matches(name, /\b(tract|fasciculus|commissure|stria)\b/)) return 'zenuwbaan';
    if (matches(name, /\b(sulcus|sulci|fissure)\b/)) return 'hersengroeve';
    if (matches(name, /\b(gyrus|gyri|lobule|cuneus)\b/)) return 'hersenwinding';
    if (matches(name, /\b(nucleus|nuclei|ganglion|ganglia)\b/)) return 'zenuwknoop';
    return 'hersendeel';
  }
  if (system === 'visceral') {
    if (matches(name, /\b(bronchus|bronchi|bronchial)\b/)) return 'bronchus';
    if (matches(name, /\b(duct|ureter|urethra)\b/)) return 'afvoerbuis';
    if (matches(name, /\b(gland|hypophysis|suprarenal|thymus|pineal)\b/)) return 'klier';
    if (matches(name, /\b(intestine|colon|rectum|duodenum|jejunum|ileum|appendix)\b/)) return 'darm';
    return 'orgaan';
  }
  return 'onbekend';
}

export function anatomyTeaching(base, info = {}) {
  const name = String(base || '').replace(/\.[lr]$/, '').trim().toLowerCase();
  if (UNCLEAR.has(name)) return null;
  const system = String(info?.system || '').toLowerCase();
  const type = classFor(name, system);
  const item = TYPES[type];
  return {
    kind: item.kind,
    explanation: item.general,
    question: item.question,
    systemName: SYSTEMS[system] || 'het lichaam',
    type,
    status: 'algemene-uitleg'
  };
}
