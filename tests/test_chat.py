"""Conversa: @nome vira instrução pra sessão.  python3 -m unittest discover tests"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))
import chat  # noqa: E402


class Mentions(unittest.TestCase):
    def setUp(self):
        chat.CHAT_DIR = Path(tempfile.mkdtemp())
        self.c = chat.Chat()

    def test_sem_mencao_entrega_o_texto_igual(self):
        self.c.send("s", "oi")
        self.assertEqual(self.c.poll("s", 0)[0]["texto"], "oi")

    def test_mencao_acrescenta_instrucao_e_guarda_quem_foi_chamado(self):
        self.c.send("s", "@Rex olha isso", [("revisor-de-codigo", "Rex")])
        entregue = self.c.poll("s", 0)[0]["texto"]
        self.assertTrue(entregue.startswith("@Rex olha isso"))
        self.assertIn('subagent_type "revisor-de-codigo"', entregue)
        msg = self.c.messages("s")[0]
        self.assertEqual((msg["texto"], msg["agentes"]), ("@Rex olha isso", ["Rex"]))


if __name__ == "__main__":
    unittest.main()
