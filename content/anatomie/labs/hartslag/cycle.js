// Didactisch vereenvoudigde hartcyclus bij 75 slagen per minuut (0,80 s).
// De waarden zijn gekozen als illustratie van gezonde rustfysiologie.
// Geen patiëntgegevens, meetwaarden of individueel voorspellend model.
// Fasen: vulling -> boezemsystole -> isovolumetrische contractie ->
// ejectie -> isovolumetrische relaxatie.
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const span=(t,a,b)=>ease((t-a)/(b-a));
export const PHASES=Object.freeze([
  {id:'vulling',at:0,end:.52,title:'De kamers vullen zich',
   text:'Bloed stroomt vanuit de boezems naar de hartkamers. De kleppen tussen boezems en kamers zijn open; de slagaderkleppen blijven dicht.',
   hint:'Tijdens de vulling neemt het kamervolume toe. Bekijk de groene volumelijn.'},
  {id:'atria',at:.52,end:.64,title:'De boezems trekken samen',
   text:'De boezems persen het laatste bloed de kamers in. De AV-kleppen staan nog open. Aan het einde van deze fase zijn de kamers maximaal gevuld.',
   hint:'Kijk hoe het kamervolume nog iets stijgt. Daarna sluiten de AV-kleppen.'},
  {id:'isocontractie',at:.64,end:.70,title:'De kamerdruk stijgt',
   text:'De kamers beginnen samen te trekken. De AV-kleppen sluiten, maar de slagaderkleppen zijn nog dicht. De druk stijgt terwijl het kamervolume gelijk blijft.',
   hint:'Dit heet isovolumetrische contractie. De druk stijgt al voordat het bloed wordt uitgepompt.'},
  {id:'ejectie',at:.70,end:.93,title:'Bloed wordt uitgepompt',
   text:'De druk in de kamers wordt groot genoeg om de slagaderkleppen te openen. Bloed stroomt vanuit de rechterkamer naar de longen en vanuit de linkerkamer naar het lichaam.',
   hint:'Let op: het kamervolume daalt terwijl de druk hoog is. De AV-kleppen blijven dicht.'},
  {id:'relaxatie',at:.93,end:1,title:'De kamers ontspannen',
   text:'De slagaderkleppen sluiten en de kamers ontspannen. Beide klepsoorten zijn kort dicht. De druk daalt voordat de kamers opnieuw gaan vullen.',
   hint:'Dit heet isovolumetrische relaxatie: de druk daalt, maar het kamervolume blijft nog gelijk.'}
]);
export const phaseFor=t=>PHASES.findIndex((p,i)=>t>=p.at&&t<(i===PHASES.length-1?1:p.end));
export function volume(t){
  if(t<.52)return lerp(60,116,span(t,0,.52));
  if(t<.64)return lerp(116,130,span(t,.52,.64));
  if(t<.70)return 130;
  if(t<.93)return lerp(130,60,span(t,.70,.93));
  return 60;
}
export function pressure(t){
  if(t<.52)return lerp(5,8,span(t,0,.52));
  if(t<.64)return lerp(8,12,span(t,.52,.64));
  if(t<.70)return lerp(12,85,span(t,.64,.70));
  if(t<.76)return lerp(85,120,span(t,.70,.76));
  if(t<.88)return lerp(120,88,span(t,.76,.88));
  if(t<.93)return lerp(88,76,span(t,.88,.93));
  return lerp(76,5,span(t,.93,1));
}
export function mechanics(t){
  const volumeFrac=(volume(t)-60)/70;
  const atriumShrink=t>=.52&&t<.64?1-.16*Math.sin(Math.PI*(t-.52)/.12):1;
  return {av:t<.64,sem:t>=.70&&t<.93,ventScale:.79+.21*volumeFrac,
    atriumScale:atriumShrink,pressure:pressure(t),volume:volume(t),phase:phaseFor(t)};
}
