export const opening = "Goedemiddag allemaal, beste leerlingen en collega's,\n\nOnze rector kan er vanmiddag helaas niet bij zijn. Ik mag daarom namens de schoolleiding het woord voeren.\n\nAllereerst wil ik jullie van harte feliciteren met het behalen van jullie DELF scolaire-diploma. Van A2 tot en met B2. Een mooie prestatie, waar we als schoolleiding trots op zijn.\n\nEn natuurlijk wil ik ook iets zeggen over het belang van de Franse taal...";
export const reply = "Nou, vooruit. Maar gedraag je een beetje.";
export const closing = "Dank je wel. Ik geloof dat ik zojuist ook nog even op mijn plaats ben gezet.\n\nBeste leerlingen,\n\nNogmaals van harte gefeliciteerd. Jullie mogen trots zijn op wat jullie hebben bereikt.\n\nMevrouw Klatten wil ik graag bedanken voor alle inzet en begeleiding. Zonder haar hadden we hier vanmiddag niet zo gestaan.\n\nEn dan wordt het tijd voor waar jullie voor gekomen zijn: de diploma's!";
export const interrupt = "Ho, ho. Wacht eens even!\n\nWe hebben hier leerlingen die een officieel diploma Frans hebben gehaald, en jij houdt doodleuk een toespraak in het Nederlands?\n\nDat meen je toch niet?\n\nLaat mij dit maar even doen. Ik denk dat het in het Frans een stuk beter klinkt.";
export const handback = "Zo. Volgens mij is nu wel duidelijk hoe belangrijk de Franse taal is.\n\nEn ik moet toegeven: je leerlingen hebben het beter begrepen dan jij.\n\nMaar goed, ik zal niet ál je werk overnemen.\n\nAan jou om af te sluiten. In het Nederlands, vooruit dan maar.";
// Ruimte om na de Nederlandse onderbreking zelf te antwoorden.
export const replyPauseMs = 4600;
export const speech = "Mesdames et messieurs, chers élèves,\n\nVous venez d'assister à quelque chose d'assez extraordinaire.\n\nUn conrecteur de l'Emmauscollege qui prononce un discours sur l'importance du français… en néerlandais !\n\nIncroyable !\n\nHeureusement, je suis là.\n\nCar enfin, parlons sérieusement !\n\nLe français n'est pas une langue comme les autres.\n\nC'est la langue de Molière, de Victor Hugo, de la poésie, de la gastronomie et de l'élégance !\n\nUne langue dans laquelle même une simple commande de café peut devenir une œuvre d'art.\n\nEt soyons honnêtes : « Je t'aime », c'est quand même un peu plus romantique que « Ik hou van jou ».\n\nMais aujourd'hui, les véritables artistes, c'est vous.\n\nVous avez obtenu vos diplômes DELF scolaire, du niveau A2 au niveau B2.\n\nEt cela mérite nos applaudissements.\n\nParce qu'apprendre une langue demande du travail, de la persévérance et du courage.\n\nIl faut oser parler, même quand on cherche ses mots. Il faut accepter de faire des erreurs. Et surtout, il faut continuer.\n\nVous l'avez fait. Et vous avez réussi.\n\nAu nom de toute la direction de l'Emmauscollege, je peux vous dire une chose : nous sommes très fiers de vous.\n\nUn grand merci également à Madame Klatten, pour son engagement et tout le travail accompli auprès des élèves.\n\nChers diplômés, profitez de ce moment.\n\nSoyez fiers de vos résultats, mais aussi du chemin parcouru.\n\nEt surtout, continuez à parler français !\n\nMême si votre conrecteur préfère encore le néerlandais...\n\nToutes mes félicitations à vous !";

export function paragraphs(text){return String(text).split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);}
export function modelFiles(files){
 const arr=Array.from(files||[]);
 const locate=(name)=>arr.find(f=>f.name===name);
 const weights=locate('model.q8.gguf'),config=locate('config.json'),tokenizer=locate('tokenizer.json');
 const voice=locate('default-voice.safetensors')||arr.find(f=>/\.safetensors$/i.test(f.name)&&f.name!=='model.safetensors');
 const missing=[['model.q8.gguf',weights],['config.json',config],['tokenizer.json',tokenizer],['default-voice.safetensors of een stem uit voices/',voice]].filter(x=>!x[1]).map(x=>x[0]);
 return {weights,config,tokenizer,voice,missing};
}
export function stageAdvance(phase, action){
 const transitions={intro:{start:'live',reset:'intro'},live:{interrupt:'interrupted',reset:'intro'},interrupted:{french:'french',reset:'intro'},french:{handback:'handback',reset:'intro'},handback:{finish:'live',reset:'intro'}};
 if(action==='panic') return 'stopped';
 if(phase==='stopped'&&action==='reset')return 'intro';
 return transitions[phase]?.[action]??null;
}

// Show short French phrases in sync with the stream, without one-word animations.
export function speechSegments(value) {
  const sections = paragraphs(value);
  const output = [];
  for (const section of sections) {
    const sentences = section.match(/[^.!?…]+[.!?…]+(?:[”»']+)?|[^.!?…]+$/g) || [section];
    let segment = '';
    for (const sentence of sentences) {
      const part = sentence.trim();
      if (!part) continue;
      if (segment && segment.length + part.length > 162) {
        output.push(segment);
        segment = part;
      } else segment = segment ? segment + ' ' + part : part;
    }
    if (segment) output.push(segment);
  }
  return output;
}
