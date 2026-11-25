"""Controleer de interpretatie van StatsBomb 360 zonder netwerk."""
import unittest
from analyze_open_football import analyze, segment_distance


class VoetbalbronTest(unittest.TestCase):
    def test_afstand_tot_eindige_passlijn(self):
        self.assertAlmostEqual(segment_distance([5, 2],[0,0],[10,0]),2)
        self.assertAlmostEqual(segment_distance([12, 0],[0,0],[10,0]),2)

    def test_zichtbare_verdedigers_en_passuitkomst(self):
        events = [
            {"id":"een","type":{"name":"Pass"},"location":[10,30],"pass":{"end_location":[20,30]}},
            {"id":"twee","type":{"name":"Pass"},"location":[20,30],"pass":{"end_location":[20,40],"outcome":{"name":"Incomplete"}}},
            {"id":"drie","type":{"name":"Pass"},"location":[20,30],"pass":{"end_location":[30,30]}}
        ]
        frames = [
            {"event_uuid":"een","freeze_frame":[{"teammate":False,"location":[15,32]}]},
            {"event_uuid":"twee","freeze_frame":[{"teammate":False,"location":[26,35]}]}
        ]
        result = analyze(events,frames)
        self.assertEqual(result["totaal_passevents"],3)
        self.assertEqual(result["zonder_360_frame"],1)
        self.assertEqual(result["aantal_passevents_met_bruikbaar_beeld"],2)
        self.assertEqual(result["per_resultaat"]["complete"]["passbaan_120x80_eenheden"]["mediaan"],2)
        self.assertEqual(result["per_resultaat"]["not_complete"]["passbaan_120x80_eenheden"]["mediaan"],6)


if __name__ == "__main__":
    unittest.main()
