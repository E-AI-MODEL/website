import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from release_artifact import record, verify


class ArtifactTests(unittest.TestCase):
    def test_manifest_binds_exact_files_and_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry = root / "index.html"
            entry.write_text("test")
            hidden = root / ".htaccess"
            hidden.write_text("header")
            manifest = record(root, "a" * 40)
            self.assertIn(".htaccess", manifest["files"])
            verify(root, "a" * 40, manifest)
            with self.assertRaises(ValueError):
                verify(root, "b" * 40, manifest)
            hidden.unlink()
            with self.assertRaises(ValueError):
                verify(root, "a" * 40, manifest)
            hidden.write_text("header")
            extra = root / "extra"
            extra.write_text("not tested")
            with self.assertRaises(ValueError):
                verify(root, "a" * 40, manifest)
            extra.unlink()
            entry.write_text("modified")
            with self.assertRaises(ValueError):
                verify(root, "a" * 40, manifest)
            entry.write_text("test")
            verify(root, "a" * 40, manifest)

    def test_symlinks_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text("test")
            (root / "link").symlink_to(root / "index.html")
            with self.assertRaises(ValueError):
                record(root, "a" * 40)
