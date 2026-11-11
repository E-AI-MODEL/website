// Anatomie-bronnen voor leerlinggerichte uitleg.
// Beoordeling: uitsluitend een verwijzing naar de geraadpleegde sectie,
// geen certificering van iedere Nederlandse formulering of het 3D-model.
// Terminologia Anatomica is een bron voor NAAMGEVING, niet voor fysiologie.
const REFERENCES = Object.freeze({
  terminology: {
    label: 'FIPAT, Terminologia Anatomica 2 (naamgeving)',
    url: 'https://ifaa.net/committees/anatomical-terminology-fipat/fipat-ifaa-terminologies/'
  },
  model: {
    label: 'Z-Anatomy / BodyParts3D (3D-model en oorspronkelijke namen)',
    url: 'https://github.com/nqwrc/3d-anatomy'
  },
  bones: {
    label: 'OpenStax, 6.3 Botopbouw',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/6-3-bone-structure'
  },
  vertebrae: {
    label: 'OpenStax, 7.3 Wervelkolom',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/7-3-the-vertebral-column'
  },
  thorax: {
    label: 'OpenStax, 7.4 Borstkas',
    url: 'https://openstax.org/books/anatomy-and-physiology/pages/7-4-the-thoracic-cage'
  },
  joints: {
    label: 'OpenStax, 9.4 Gewrichten',
    url: 'https://openstax.org/books/anatomy-and-physiology/pages/9-4-synovial-joints'
  },
  cartilage: {
    label: 'OpenStax, 9.3 Kraakbeenverbindingen',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/9-3-cartilaginous-joints'
  },
  muscles: {
    label: 'OpenStax, 10.2 Skeletspieren',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/10-2-skeletal-muscle'
  },
  nervous: {
    label: 'OpenStax, 13.2 Centraal zenuwstelsel',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/13-2-the-central-nervous-system'
  },
  senses: {
    label: 'OpenStax, 14.1 Zintuiglijke waarneming',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/14-1-sensory-perception'
  },
  vision: {
    label: 'OpenStax, 14.2 Verwerking van zintuigsignalen',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/14-2-central-processing'
  },
  heart: {
    label: 'OpenStax, 19.1 Bouw en bloedstroom van het hart',
    url: 'https://openstax.org/books/anatomy-and-physiology/pages/19-1-heart-anatomy'
  },
  blood: {
    label: 'OpenStax, 20.2 Bloedstroom',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/20-2-blood-flow-blood-pressure-and-resistance'
  },
  shoulder: {
    label: 'OpenStax, 8.1 Schoudergordel',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle'
  },
  leg: {
    label: 'OpenStax, 8.4 Beenderen van het been',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb'
  },
  upperAirways: {
    label: 'OpenStax, 22.1 Bouw van de luchtwegen',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/22-1-organs-and-structures-of-the-respiratory-system'
  },
  lungs: {
    label: 'OpenStax, 22.2 Longen en borstvlies',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/22-2-the-lungs'
  },
  stomach: {
    label: 'OpenStax, 23.4 De maag',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/23-4-the-stomach'
  },
  digestion: {
    label: 'OpenStax, 23.5 Dunne en dikke darm',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/23-5-the-small-and-large-intestines'
  },
  digestionOrgans: {
    label: 'OpenStax, 23.6 Lever, galblaas en alvleesklier',
    url: 'https://openstax.org/books/anatomy-and-physiology/pages/23-6-accessory-organs-in-digestion-the-liver-pancreas-and-gallbladder'
  },
  urine: {
    label: 'OpenStax, 25.2 Transport en opslag van urine',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/25-2-gross-anatomy-of-urine-transport'
  },
  kidney: {
    label: 'OpenStax, 25.3 Bouw van de nier',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/25-3-gross-anatomy-of-the-kidney'
  },
  lowerLimbMuscles: {
    label: 'OpenStax, 11.6 Spieren van bekken en benen',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs'
  },
  circulation: {
    label: 'OpenStax, 20.5 Grote slagaders en aders',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways'
  },
  peripheralNerves: {
    label: 'OpenStax, 13.4 Zenuwen buiten hersenen en ruggenmerg',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/13-4-the-peripheral-nervous-system'
  },
  hippocampus: {
    label: 'OpenStax, 16.2 Geheugen en hippocampus',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/16-2-the-mental-status-exam'
  },
  lymph: {
    label: 'OpenStax, 21.1 Lymfe- en afweerstelsel',
    url: 'https://openstax.org/books/anatomy-and-physiology/pages/21-1-anatomy-of-the-lymphatic-and-immune-systems'
  }
});

// Alleen opname als de bronsectie de inhoud van de betreffende uitleg
// daadwerkelijk behandelt. Niet alle 62 eigen uitlegteksten staan hierin.
const SUPPORTED_GUIDES = Object.freeze({
  'vertebra c4': 'vertebrae',
  'intervertebral disc c4-c5': 'vertebrae',
  'nucleus pulposus c4-c5': 'vertebrae',
  'first rib': 'thorax',
  'body of sternum': 'thorax',
  'lateral meniscus': 'joints',
  'medial meniscus': 'joints',
  'articular capsule of knee joint': 'joints',
  'articular capsule of glenohumeral joint': 'joints',
  'anterior cruciate ligament': 'joints',
  'posterior cruciate ligament': 'joints',
  'left ventricle': 'heart',
  'right ventricle': 'heart',
  'left atrium': 'heart',
  'right atrium': 'heart',
  'aortic arch': 'heart',
  'ascending aorta': 'heart',
  'superior vena cava': 'heart',
  'pulmonary trunk': 'heart',
  'coronary sinus': 'heart',
  'cornea': 'senses',
  'retina': 'senses',
  'optic chiasm': 'vision',
  'optic nerve (ii)': 'senses',
  'corpus callosum': 'nervous',
  'central sulcus': 'nervous',
  'posterior horn of spinal cord': 'nervous',
  'spleen': 'lymph',
  'renal pelvis': 'kidney',
  'kidney': 'kidney',
  'urinary bladder': 'urine',
  'ureter': 'urine',
  'femur': 'leg',
  'tibia': 'leg',
  'patella': 'leg',
  'scapula': 'shoulder',
  'clavicle': 'shoulder',
  'pleura': 'lungs',
  'diaphragm': 'lungs',
  'trachea': 'upperAirways',
  'left main bronchus': 'upperAirways',
  'right main bronchus': 'upperAirways',
  'liver': 'digestionOrgans',
  'pancreas': 'digestionOrgans',
  'pancreatic duct': 'digestionOrgans',
  'stomach': 'stomach',
  'duodenum': 'digestion',
  'tibialis anterior muscle': 'lowerLimbMuscles',
  'femoral artery': 'circulation',
  'ulnar artery': 'circulation',
  'femoral vein': 'circulation',
  'basilar artery': 'circulation',
  'sciatic nerve': 'peripheralNerves',
  'abdominal aorta': 'circulation',
  'thoracic aorta': 'circulation',
  'hippocampus': 'hippocampus',
});

const GENERAL_REFERENCES = Object.freeze({
  bot: 'bones', rib: 'thorax', wervel: 'vertebrae',
  kraakbeen: 'cartilage', band: 'joints', kapsel: 'joints',
  schijf: 'cartilage', nucleus: 'vertebrae', meniscus: 'joints',
  vetkussen: 'joints', slijmbeurs: 'joints', peesschede: 'joints',
  spier: 'muscles', pees: 'muscles',
  slagader: 'blood', ader: 'blood', hartklep: 'heart',
  hartspier: 'heart', bloedvat: 'heart',
  afweerorgaan: 'lymph', lymfeklier: 'lymph', lymfevat: 'lymph',
  zenuwbaan: 'nervous', zenuwvlies: 'nervous',
  hersengroeve: 'nervous', hersenwinding: 'nervous',
  zenuwknoop: 'nervous', hersendeel: 'nervous', zintuig: 'senses',
});

export function anatomySourceStatus(base, lessonType) {
  const key=String(base || '').replace(/\.[lr]$/,'').trim().toLowerCase();
  const referenceId=SUPPORTED_GUIDES[key] || null;
  const generalId=lessonType && GENERAL_REFERENCES[lessonType] || null;
  return {
    specific: referenceId ? REFERENCES[referenceId] : null,
    general: generalId ? REFERENCES[generalId] : null,
    terminology: REFERENCES.terminology,
    model: REFERENCES.model,
    hasSpecific: Boolean(referenceId)
  };
}

export const supportedGuideKeys=Object.freeze(Object.keys(SUPPORTED_GUIDES));
