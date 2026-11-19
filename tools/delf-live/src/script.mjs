export const interrupt = 'Stop. Mag ik je even onderbreken? We zijn hier om leerlingen te feliciteren met hun Frans. Is het dan niet eerlijker om hen ook in het Frans toe te spreken? Vind je het goed als ik het vanaf hier overneem?';
export const handback = 'Volgens mij heb ik je hiermee genoeg geholpen. Aan jou om deze bijzondere avond zelf af te sluiten.';
// Laat de spreker rustig reageren na de Nederlandse onderbreking.
export const replyPauseMs = 4600;
export const speech = `Chers élèves, chers parents, chers collègues,

Ce soir, nous célébrons votre réussite. Vous avez choisi d'aller plus loin dans l'apprentissage du français. Vous avez étudié, pratiqué, parfois hésité, puis recommencé. Et aujourd'hui, vous recevez le diplôme DELF scolaire.

Ce diplôme est une reconnaissance officielle de votre niveau de français. Mais il raconte aussi quelque chose de vous. Il montre que vous avez osé parler une autre langue, chercher vos mots, écouter les autres et continuer même quand ce n'était pas facile.

Apprendre une langue, c'est bien plus que connaître du vocabulaire ou des règles de grammaire. C'est pouvoir rencontrer d'autres personnes, comprendre d'autres idées et se sentir un peu plus chez soi dans le monde.

Alors, profitez de cette soirée. Soyez fiers du chemin parcouru, de votre travail et de ce que vous avez accompli. Aux enseignants et à toutes les personnes qui vous ont accompagnés, merci.

Et à vous, les diplômés : toutes mes félicitations ! Continuez à être curieux, à apprendre et, surtout, à oser parler français.`;
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
