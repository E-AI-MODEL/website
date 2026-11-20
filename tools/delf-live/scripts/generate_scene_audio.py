#!/usr/bin/env python3
"""Generate two offline French audio scenes with the open Kokoro model."""
import json
import re
import subprocess
import tempfile
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'public/audio'
SCENE_1="""Un instant ! Pardon, mais ça ne va pas du tout !
Ces élèves viennent de réussir leur DELF scolaire, un diplôme de français, et leur conrecteur leur fait un discours... en néerlandais ?
C'est quand même incroyable !
Le français mérite mieux que ça, non ?"""
END="""Et maintenant, je vous rends la parole.
Merci à tous, et encore toutes mes félicitations !"""

def speech():
    text=(ROOT/'src/script.mjs').read_text(encoding='utf-8')
    match=re.search(r'export const speech = ("(?:\\.|[^"\\])*");',text)
    if not match:
        raise ValueError('French source speech missing')
    return json.loads(match.group(1))

def synth(pipeline, text, name, speed):
    pieces=[]
    count=0
    gap=np.zeros(24000//5,dtype=np.float32)
    for item in pipeline(text,voice='ff_siwis',speed=speed,split_pattern=r'\n+'):
        audio=item.audio if hasattr(item,'audio') else item[2]
        if audio is None:continue
        pcm=audio.detach().cpu().numpy() if hasattr(audio,'detach') else np.asarray(audio)
        pcm=np.asarray(pcm,dtype=np.float32).flatten()
        if len(pcm)<1000:continue
        pieces.extend([pcm,gap])
        count+=1
        print(name,'segment',count,len(pcm),flush=True)
    if not pieces:raise RuntimeError('No audio generated: '+name)
    output=np.concatenate(pieces)
    peak=float(np.max(np.abs(output)))
    if peak < .02 or peak > 1.5:raise RuntimeError('Invalid output peak: '+str(peak))
    output=np.clip(output*min(.95/peak,2.8),-.985,.985)
    duration=len(output)/24000
    if not 7 < duration < 480:raise RuntimeError('Unexpected length: '+str(duration))
    OUTPUT.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav=Path(tmp)/'source.wav'
        sf.write(wav,output,24000,subtype='PCM_16')
        dst=OUTPUT/name
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-qscale:a','3',str(dst)],check=True)
    print(name,'seconds',round(duration,1),'bytes',dst.stat().st_size,flush=True)
    return {'file':name,'seconds':round(duration,1),'bytes':dst.stat().st_size}

def main():
    from kokoro import KPipeline
    french=speech()
    assert 'DELF scolaire' in french and 'Madame Klatten' in french
    pipeline=KPipeline(lang_code='f')
    a=synth(pipeline,SCENE_1,'scene-1-interruption.mp3',.99)
    b=synth(pipeline,french+'\n\n'+END,'scene-2-discours.mp3',.96)
    (OUTPUT/'audio-manifest.json').write_text(json.dumps({'model':'hexgrad/Kokoro-82M','voice':'ff_siwis','scenes':[a,b]},indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
