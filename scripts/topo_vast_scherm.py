#!/usr/bin/env python3
"""Koppelt de gedeelde vaste-schermlaag aan alle TOPO-pagina's.

Elke pagina laadt /topo/vast-scherm.css en /topo/vast-scherm.js met een versie (?v=)
die gelijk is aan de inhoud. Zo krijgt niemand een oude laag uit de cache bij een nieuwe pagina.
  python3 scripts/topo_vast_scherm.py          zet de juiste versie in de PO-pagina's
  python3 scripts/topo_vast_scherm.py --check  faalt als een pagina de laag mist of een oude versie heeft
De VO-pagina's krijgen de tags via scripts/topo_vo/maak_paginas.py (zelfde functie)."""
import hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PO = ['topo/index.html', 'topo/instellingen/index.html', 'topo/nederland/index.html']
VO = ['topo/vo/index.html', 'topo/vo/spel/index.html']


def versie(naam):
    return hashlib.sha256((ROOT / 'topo' / naam).read_bytes()).hexdigest()[:10]


def tags():
    return ('<link rel="stylesheet" href="/topo/vast-scherm.css?v=%s">'
            '<script src="/topo/vast-scherm.js?v=%s" defer></script>') % (versie('vast-scherm.css'), versie('vast-scherm.js'))


PATROON = re.compile(r'<link rel="stylesheet" href="/topo/vast-scherm\.css\?v=[0-9a-f]+"><script src="/topo/vast-scherm\.js\?v=[0-9a-f]+" defer></script>')


def main():
    check = '--check' in sys.argv
    goed = tags()
    fouten = []
    for rel in PO + VO:
        p = ROOT / rel
        s = p.read_text(encoding='utf-8')
        gevonden = PATROON.findall(s)
        if len(gevonden) != 1:
            fouten.append('%s: vaste-schermlaag %d keer gevonden (moet 1 zijn)' % (rel, len(gevonden)))
            continue
        if gevonden[0] == goed:
            continue
        if rel in VO and not check:
            print('%s: draai nu scripts/topo_vo/maak_paginas.py' % rel)
        elif check:
            fouten.append('%s: oude versie van de vaste-schermlaag%s' % (rel, '' if rel in PO else ' (draai maak_paginas.py)'))
        else:
            p.write_text(s.replace(gevonden[0], goed), encoding='utf-8')
            print('bijgewerkt:', rel)
    if fouten:
        print('\n'.join(fouten))
        sys.exit(1)
    print('vaste-schermlaag in orde:', goed)


if __name__ == '__main__':
    main()
