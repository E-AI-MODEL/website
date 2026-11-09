// Korte, handmatig gecontroleerde uitleg voor veelgebruikte structuren.
// Aanvullend op de bestaande bronbeschrijvingen, niet een automatische
// afleiding van de Engelse naam. Geen verzonnen functie bij ontbrekende data.
const ITEMS = {
  'pleura': {
    name: 'Borstvlies (pleura)',
    function: 'Het borstvlies laat de longen met weinig wrijving langs de borstwand bewegen tijdens het ademen.',
    location: 'Een dubbel vlies rond de longen en langs de binnenzijde van de borstkas.',
    mechanism: 'Tussen beide vliezen zit een smalle, met vocht gevulde ruimte. De vliezen bewegen langs elkaar terwijl de long de beweging van de borstkas volgt.'
  },
  'fascia lata': {
    name: 'Dijbeenfascie (fascia lata)',
    function: 'Dit stevige bindweefsel omhult de spieren van het bovenbeen en helpt krachten over te dragen.',
    location: 'Rond de spieren van het bovenbeen, van het bekken naar de knie.',
    mechanism: 'Verdikkingen en tussenschotten ondersteunen en scheiden verschillende spiergroepen.'
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
    function: 'Het dijbeen draagt gewicht en maakt bewegingen van heup en knie mogelijk.',
    location: 'In het bovenbeen, tussen heupgewricht en kniegewricht.',
    mechanism: 'Het bot vormt een hefboom waaraan spieren trekken om het been te bewegen.'
  },
  'patella': {
    name: 'Knieschijf',
    function: 'De knieschijf helpt de strekspieren van het bovenbeen de knie efficiënt te strekken.',
    location: 'Aan de voorzijde van het kniegewricht, in de pees van de bovenbeenspieren.',
    mechanism: 'De knieschijf vergroot de hefboomwerking van de strekspieren tijdens het strekken van de knie.'
  },
  'tibia': {
    name: 'Scheenbeen',
    function: 'Het scheenbeen draagt een groot deel van het lichaamsgewicht van de knie naar de enkel.',
    location: 'Aan de binnenzijde en voorkant van het onderbeen.',
    mechanism: 'Het vormt een dragende verbinding tussen knie en enkel en geeft aanhechtingsplaatsen aan spieren.'
  },
  'sciatic nerve': {
    name: 'Heupzenuw',
    function: 'De heupzenuw vervoert signalen voor de beweging en gevoelswaarneming van grote delen van het been.',
    location: 'Vanuit het bekken via de bil naar de achterzijde van het bovenbeen.',
    mechanism: 'Zenuwvezels voeren motorische signalen naar spieren en gevoelsinformatie terug richting het ruggenmerg.'
  },
  'hippocampus': {
    name: 'Hippocampus',
    function: 'De hippocampus speelt een grote rol bij het vormen van nieuwe herinneringen en het verwerken van ruimtelijke informatie.',
    location: 'Diep in de slaapkwab van de hersenen, aan beide zijden.',
    mechanism: 'De hippocampus werkt samen met andere hersengebieden bij het vastleggen en terugvinden van ervaringen.'
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
  }
};
export function anatomyGuide(base) {
  const key = String(base || '').replace(/\\.[lr]$/, '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ITEMS, key) ? ITEMS[key] : null;
}
