/* EAIgame niveauproeven: inhoudelijk andere taken per niveau.
   Eigen redactionele voorbeelden, niet geijkt en geen officiële SLO-opgaven.
   De oorspronkelijke 300 ID's blijven bestaan, zodat opslag en UI niet breken. */
(function(){
 'use strict';
 const list=window.EAIGAME_LEVEL_QUESTIONS;
 if(!Array.isArray(list)||list.length!==300)return;
 const pilots={
  "breuk-01-vmbo": {
    "id": "breuk-01-vmbo",
    "type": "choice",
    "prompt": "Een kwart van 12 leerlingen gaat fietsen. Hoeveel leerlingen zijn dat?",
    "options": [
      "3",
      "4",
      "6",
      "9"
    ],
    "answer": 0,
    "explanation": "Een kwart betekent delen door vier. 12 ÷ 4 = 3.",
    "hint": "Verdeel 12 in vier gelijke groepen."
  },
  "breuk-01-havo": {
    "id": "breuk-01-havo",
    "type": "choice",
    "prompt": "Een recept vraagt 2/3 liter melk. Je hebt 1/4 liter. Hoeveel liter kom je tekort?",
    "options": [
      "5/12 liter",
      "1/2 liter",
      "1/3 liter",
      "7/12 liter"
    ],
    "answer": 0,
    "explanation": "Schrijf beide breuken met noemer 12: 8/12 − 3/12 = 5/12 liter.",
    "hint": "Maak de noemers eerst gelijk."
  },
  "breuk-01-vwo": {
    "id": "breuk-01-vwo",
    "type": "choice",
    "prompt": "Na 20% korting kost een fietshelm €72. Wat was de prijs vóór de korting?",
    "options": [
      "€90",
      "€86,40",
      "€84",
      "€96"
    ],
    "answer": 0,
    "explanation": "€72 is 80% van de oorspronkelijke prijs. 72 ÷ 0,8 = €90.",
    "hint": "Bereken eerst welk percentage €72 is."
  },
  "breuk-02-vmbo": {
    "id": "breuk-02-vmbo",
    "type": "choice",
    "prompt": "Drie dezelfde kaartjes kosten samen €6. Wat kosten vijf kaartjes?",
    "options": [
      "€10",
      "€8",
      "€12",
      "€15"
    ],
    "answer": 0,
    "explanation": "Eén kaartje kost €2. Vijf kaartjes kosten 5 × €2 = €10.",
    "hint": "Bereken eerst de prijs van één kaartje."
  },
  "breuk-02-havo": {
    "id": "breuk-02-havo",
    "type": "choice",
    "prompt": "In een groep is de verhouding jongens : meisjes gelijk aan 2 : 3. Er zijn 30 leerlingen. Hoeveel meisjes zijn er?",
    "options": [
      "18",
      "12",
      "15",
      "20"
    ],
    "answer": 0,
    "explanation": "De verhouding heeft vijf delen. 30 ÷ 5 = 6 per deel. Drie delen zijn 18.",
    "hint": "Hoeveel delen zijn er in totaal?"
  },
  "breuk-02-vwo": {
    "id": "breuk-02-vwo",
    "type": "choice",
    "prompt": "De zijden van een rechthoek hebben de verhouding 2 : 3. De oppervlakte is 96 cm². Hoe lang is de kortste zijde?",
    "options": [
      "8 cm",
      "6 cm",
      "12 cm",
      "16 cm"
    ],
    "answer": 0,
    "explanation": "Schrijf de zijden als 2k en 3k. Dan is 6k² = 96, dus k = 4. De kortste zijde is 8 cm.",
    "hint": "Noem de zijden 2k en 3k."
  },
  "storm-01-vmbo": {
    "id": "storm-01-vmbo",
    "type": "choice",
    "prompt": "Een lamp brandt. Welke energie wordt in de lamp voor een deel omgezet in licht?",
    "options": [
      "Elektrische energie",
      "Bewegingsenergie",
      "Zwaarte-energie",
      "Geluidsenergie"
    ],
    "answer": 0,
    "explanation": "De lamp ontvangt elektrische energie en zet een deel daarvan om in licht en warmte.",
    "hint": "Welke energie ontvangt de lamp via de draden?"
  },
  "storm-01-havo": {
    "id": "storm-01-havo",
    "type": "choice",
    "prompt": "Een lamp heeft een vermogen van 6 watt en brandt 10 seconden. Hoeveel energie verbruikt de lamp?",
    "options": [
      "60 joule",
      "0,6 joule",
      "16 joule",
      "600 joule"
    ],
    "answer": 0,
    "explanation": "Energie = vermogen × tijd. 6 W × 10 s = 60 J.",
    "hint": "1 watt is 1 joule per seconde."
  },
  "storm-01-vwo": {
    "id": "storm-01-vwo",
    "type": "choice",
    "prompt": "Een lamp neemt 12 watt op. Daarvan wordt 25% licht. Hoeveel joule lichtenergie levert de lamp in 20 seconden?",
    "options": [
      "60 joule",
      "240 joule",
      "3 joule",
      "48 joule"
    ],
    "answer": 0,
    "explanation": "12 W × 20 s = 240 J in totaal. 25% daarvan is 60 J lichtenergie.",
    "hint": "Bereken eerst alle opgenomen energie."
  },
  "storm-02-vmbo": {
    "id": "storm-02-vmbo",
    "type": "choice",
    "prompt": "Een fietser legt 100 meter af in 20 seconden. Wat is de gemiddelde snelheid?",
    "options": [
      "5 m/s",
      "20 m/s",
      "80 m/s",
      "2000 m/s"
    ],
    "answer": 0,
    "explanation": "Gemiddelde snelheid = afstand ÷ tijd: 100 ÷ 20 = 5 m/s.",
    "hint": "Deel meters door seconden."
  },
  "storm-02-havo": {
    "id": "storm-02-havo",
    "type": "choice",
    "prompt": "Een step versnelt in 5 seconden van 0 naar 10 m/s. Wat is de gemiddelde versnelling?",
    "options": [
      "2 m/s²",
      "5 m/s²",
      "10 m/s²",
      "50 m/s²"
    ],
    "answer": 0,
    "explanation": "De snelheidsverandering is 10 m/s in 5 s: a = Δv/Δt = 2 m/s².",
    "hint": "Versnelling is snelheidsverandering per seconde."
  },
  "storm-02-vwo": {
    "id": "storm-02-vwo",
    "type": "choice",
    "prompt": "Een auto remt gelijkmatig af van 20 m/s tot stilstand in 4 seconden. Welke afstand legt de auto tijdens het remmen af?",
    "options": [
      "40 meter",
      "80 meter",
      "20 meter",
      "5 meter"
    ],
    "answer": 0,
    "explanation": "Bij constante vertraging is de gemiddelde snelheid (20+0)/2 = 10 m/s. In 4 s is dat 40 m.",
    "hint": "Bereken eerst de gemiddelde snelheid."
  },
  "echo-01-vmbo": {
    "id": "echo-01-vmbo",
    "type": "choice",
    "prompt": "Welke zin kun je controleren aan de hand van een bron?",
    "options": [
      "De voorstelling duurt 45 minuten.",
      "De voorstelling is prachtig.",
      "Iedereen vindt het spannend.",
      "De acteurs zijn geweldig."
    ],
    "answer": 0,
    "explanation": "Een speelduur is meetbaar en controleerbaar. De andere zinnen geven een oordeel.",
    "hint": "Wat kun je meten of opzoeken?"
  },
  "echo-01-havo": {
    "id": "echo-01-havo",
    "type": "choice",
    "prompt": "Een bericht zegt: 'Sinds de nieuwe schooltijden slapen leerlingen korter.' Wat moet je onderzoeken voordat je een oorzaak aanwijst?",
    "options": [
      "Of andere omstandigheden het slapen kunnen verklaren.",
      "Hoeveel likes het bericht heeft.",
      "Of de titel kort genoeg is.",
      "Welke kleur de grafiek heeft."
    ],
    "answer": 0,
    "explanation": "Een verandering na een maatregel bewijst nog niet dat die maatregel de oorzaak is.",
    "hint": "Een volgorde in de tijd is nog geen oorzakelijk verband."
  },
  "echo-01-vwo": {
    "id": "echo-01-vwo",
    "type": "choice",
    "prompt": "In twee scholen met veel huiswerk wordt weinig geslapen. Een artikel schrijft: 'Huiswerk veroorzaakt slaaptekort.' Wat is de beste kritiek?",
    "options": [
      "De samenhang bewijst geen oorzaak en andere verklaringen ontbreken.",
      "Twee scholen bewijzen een algemene wet.",
      "Een grafiek maakt de oorzaak zeker.",
      "Het aantal uren slaap is niet meetbaar."
    ],
    "answer": 0,
    "explanation": "Een gevonden samenhang toont niet aan dat huiswerk de oorzaak is. Onderzoek naar alternatieve verklaringen is nodig.",
    "hint": "Kan een derde factor beide uitkomsten beïnvloeden?"
  },
  "echo-02-vmbo": {
    "id": "echo-02-vmbo",
    "type": "choice",
    "prompt": "In de zin 'We gaan op de fiets, want dat is goedkoper' staat het argument na welk woord?",
    "options": [
      "Want",
      "We",
      "Fiets",
      "Goedkoper"
    ],
    "answer": 0,
    "explanation": "Het woord 'want' leidt hier de reden in: fietsen is goedkoper.",
    "hint": "Zoek het woord dat de reden aankondigt."
  },
  "echo-02-havo": {
    "id": "echo-02-havo",
    "type": "choice",
    "prompt": "Een leerling interviewt twee vrienden en concludeert: 'Alle brugklassers vinden dit vak saai.' Wat gaat er mis?",
    "options": [
      "De onderzochte groep is te klein en niet representatief.",
      "De zin bevat te weinig woorden.",
      "Een interview is altijd onbetrouwbaar.",
      "Twee meningen kunnen nooit verschillen."
    ],
    "answer": 0,
    "explanation": "Twee vrienden zeggen weinig over alle brugklassers. De steekproef is te beperkt.",
    "hint": "Wie zijn niet bevraagd?"
  },
  "echo-02-vwo": {
    "id": "echo-02-vwo",
    "type": "choice",
    "prompt": "Een onderzoek vindt geen statistisch overtuigend effect van een lesmethode. Een columnist schrijft: 'De methode werkt beslist niet.' Welke conclusie is zorgvuldiger?",
    "options": [
      "Het onderzoek toont geen overtuigend effect, maar sluit een effect niet uit.",
      "De methode is bewezen waardeloos.",
      "Het onderzoek bewijst dat elke leerling hetzelfde reageert.",
      "Een groter effect is nu bewezen."
    ],
    "answer": 0,
    "explanation": "Geen overtuigend aangetoond effect is niet hetzelfde als bewezen afwezigheid van een effect.",
    "hint": "Wat betekent het verschil tussen niet aantonen en weerleggen?"
  },
  "stad-01-vmbo": {
    "id": "stad-01-vmbo",
    "type": "choice",
    "prompt": "Bewoners willen een veiligere oversteekplaats in hun straat. Welke organisatie gaat meestal over lokale wegen?",
    "options": [
      "De gemeente",
      "De Europese Centrale Bank",
      "De schoolbibliotheek",
      "Een internationale rechtbank"
    ],
    "answer": 0,
    "explanation": "De gemeente beslist over veel lokale wegen en verkeersmaatregelen.",
    "hint": "Wie bestuurt de plaats waar je woont?"
  },
  "stad-01-havo": {
    "id": "stad-01-havo",
    "type": "choice",
    "prompt": "Jongeren willen een speelveld, buurtbewoners ervaren geluidsoverlast. Wat is een redelijke eerste stap?",
    "options": [
      "Beide groepen horen en mogelijke tijden en plekken onderzoeken.",
      "Zonder overleg het veld sluiten.",
      "Alleen de luidste groep volgen.",
      "Het onderwerp uitstellen zonder informatie."
    ],
    "answer": 0,
    "explanation": "Een besluit wordt beter door de belangen van beide groepen en mogelijke oplossingen te onderzoeken.",
    "hint": "Wie wordt geraakt door het besluit?"
  },
  "stad-01-vwo": {
    "id": "stad-01-vwo",
    "type": "choice",
    "prompt": "Een gemeente wil een skatepark verbieden. Welke informatie helpt de raad het besluit inhoudelijk en eerlijk te beoordelen?",
    "options": [
      "Gemeten overlast, belangen van gebruikers, alternatieven en gevolgen.",
      "Alleen de mening van de wethouder.",
      "Alleen het aantal reacties op sociale media.",
      "Een lijst met favoriete sporten van raadsleden."
    ],
    "answer": 0,
    "explanation": "Een zorgvuldige afweging laat feiten, verschillende belangen, alternatieven en gevolgen zien.",
    "hint": "Wat weet je over de gevolgen van verschillende keuzes?"
  },
  "stad-02-vmbo": {
    "id": "stad-02-vmbo",
    "type": "choice",
    "prompt": "Een bericht toont een oude foto en doet alsof die gisteren is gemaakt. Hoe controleer je het beeld?",
    "options": [
      "Zoek de oorspronkelijke foto en datum.",
      "Kijk of de foto veel likes heeft.",
      "Controleer alleen de lettergrootte.",
      "Stuur de foto naar anderen."
    ],
    "answer": 0,
    "explanation": "De herkomst en oorspronkelijke datum helpen een misleidende context te herkennen.",
    "hint": "Waar verscheen de foto als eerste?"
  },
  "stad-02-havo": {
    "id": "stad-02-havo",
    "type": "choice",
    "prompt": "Een bericht claimt dat 80% van de jongeren iets vindt, maar noemt geen onderzoek. Welke vraag stel je eerst?",
    "options": [
      "Wie zijn bevraagd en hoe is die 80% berekend?",
      "Hoeveel emoji staan in het bericht?",
      "Is de afbeelding kleurrijk?",
      "Heeft de afzender een korte naam?"
    ],
    "answer": 0,
    "explanation": "Zonder informatie over onderzoeksgroep en methode zegt een percentage weinig.",
    "hint": "Een percentage heeft een teller en een onderzochte groep."
  },
  "stad-02-vwo": {
    "id": "stad-02-vwo",
    "type": "choice",
    "prompt": "Een nieuwssite peilt alleen onder 200 vrijwillige websitebezoekers. De kop zegt: 'Nederland vindt dit.' Wat is het grootste probleem?",
    "options": [
      "Vrijwillige bezoekers vormen mogelijk geen representatieve steekproef.",
      "Er zijn precies 200 antwoorden.",
      "Er is een website gebruikt.",
      "Er zijn meerdere antwoordmogelijkheden."
    ],
    "answer": 0,
    "explanation": "Zelfselectie kan een vertekend beeld geven: bezoekers die meedoen zijn mogelijk anders dan de Nederlandse bevolking.",
    "hint": "Wie doet vanzelf mee en wie niet?"
  }
};
 for(const question of list){
  const upgrade=pilots[question.id];
  if(!upgrade)continue;
  Object.assign(question,upgrade,{
    origin:'eai-niveaupilot',
    reviewed:'redactioneel concept; niet geijkt',
    didacticLevel:question.level,
    source:{
      publisher:'EAIgame',
      curriculum:'SLO leergebied (oriëntatie, geen specifieke doel-ID)',
      link:'https://github.com/slonl/curriculum-fo'
    }
  });
 }
 window.EAIGAME_LEVEL_PILOT_COUNT=list.filter(q=>q.origin==='eai-niveaupilot').length;
})();
