"""Offline regressietest voor de labels in het openbare handbalbestand."""
import io
import unittest
import zipfile

from analyze_open_tactics import analyze_zip


class TactischeBronTest(unittest.TestCase):
    def test_groeperen_zonder_uitkomsten_te_verzinnen(self):
        rows = (
            "game,game_phases,tactical_situation,possesion_result\n"
            "1,AT,superiority,True\n"
            "1,AT,superiority,False\n"
            "2,AT,equal,True\n"
            "2,DEF,inferiority,False\n"
            "3,UNKNOWN,equal,True\n"
        ).encode("utf-8")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as archive:
            archive.writestr("HandballDataset/csv/possessions.csv", rows)
        output = analyze_zip(buf.getvalue())
        self.assertEqual(output["totaal_rijen"], 5)
        self.assertEqual(output["gebruikt"], 4)
        self.assertEqual(output["overgeslagen"], {"UNKNOWN/equal": 1})
        group = next(row for row in output["groepen"] if row["situatie"] == "superiority")
        self.assertEqual(group["bezitten"], 2)
        self.assertEqual(group["succespercentage_bron"], 50.0)


if __name__ == "__main__":
    unittest.main()
