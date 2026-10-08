"""Nova equipe sem abrir terminal de verdade.  python3 -m unittest discover tests"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))
import teams  # noqa: E402


class NewTeam(unittest.TestCase):
    def setUp(self):
        self.hub = Path(tempfile.mkdtemp())
        (self.hub / "meu-app").mkdir()
        teams.HUB_DIR = self.hub

    def launch(self, d):
        with mock.patch.object(teams.shutil, "which", lambda n: "/usr/bin/" + n if n == "gnome-terminal" else None), \
             mock.patch.object(teams.subprocess, "Popen") as popen:
            ok, _ = teams.new_team(d, "Meu App")
        return ok, (popen.call_args[0][0] if popen.called else None)

    def test_abre_terminal_na_pasta_com_o_claude_sala(self):
        ok, cmd = self.launch("meu-app")
        self.assertTrue(ok)
        self.assertIn(f"--working-directory={self.hub / 'meu-app'}", cmd)
        self.assertIn("claude-sala", cmd[-1])

    def test_pasta_de_projetos_vazia_e_hub(self):
        self.assertEqual(teams._folder(""), self.hub)

    def test_recusa_fora_da_pasta(self):
        for d in ("../etc", ".git", "nao-existe", "meu-app/sub", "/etc"):
            ok, cmd = self.launch(d)
            self.assertFalse(ok, d)
            self.assertIsNone(cmd)


if __name__ == "__main__":
    unittest.main()
