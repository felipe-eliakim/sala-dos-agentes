"""Testes do RH numa pasta temporária.  python3 -m unittest discover tests"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))
import hiring  # noqa: E402


class Hiring(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        hiring.AGENTS_DIR = self.tmp / "agents"
        hiring.FIRED_DIR = hiring.AGENTS_DIR / ".demitidos"
        hiring.USER_DIR = self.tmp / "config"
        hiring.DEPTS_FILE = hiring.USER_DIR / "departamentos.json"

    def ficha(self, **kw):
        base = {"id": "revisor", "nome": "Rex", "departamento": "Revisão", "novo": True,
                "descricao": "Revisa diffs procurando bugs de correção.", "instrucoes": "Leia o diff e aponte bugs.",
                "perms": ["ler"], "modelo": "sonnet", "cor": "green"}
        return {**base, **kw}

    def test_contrata_com_ferramentas_e_modelo(self):
        ok, _ = hiring.hire(self.ficha(perms=["web"]))
        self.assertTrue(ok)
        text = (hiring.AGENTS_DIR / "revisor.md").read_text()
        self.assertIn("tools: Read, Grep, Glob, WebFetch, WebSearch", text)
        self.assertIn("model: sonnet", text)
        a = hiring.agents()[0]
        self.assertEqual((a["nome"], a["departamento"], a["perms"]), ("Rex", "Revisão", ["ler", "web"]))

    def test_tudo_nao_restringe_ferramentas(self):
        hiring.hire(self.ficha(perms=["tudo"], modelo="inherit"))
        text = (hiring.AGENTS_DIR / "revisor.md").read_text()
        self.assertNotIn("tools:", text)
        self.assertNotIn("model:", text)

    def test_recusa_id_ruim_embutido_e_repetido(self):
        self.assertFalse(hiring.hire(self.ficha(id="../x"))[0])
        self.assertFalse(hiring.hire(self.ficha(id="Explore"))[0])
        hiring.hire(self.ficha())
        self.assertFalse(hiring.hire(self.ficha())[0])            # novo com id que já existe
        self.assertTrue(hiring.hire(self.ficha(novo=False))[0])   # edição

    def test_edicao_mantem_campos_extras(self):
        hiring.AGENTS_DIR.mkdir(parents=True)
        (hiring.AGENTS_DIR / "revisor.md").write_text("---\nname: revisor\ndescription: x\nskills:\n  - foo\n---\ncorpo\n")
        hiring.hire(self.ficha(novo=False))
        self.assertIn("skills:\n  - foo", (hiring.AGENTS_DIR / "revisor.md").read_text())

    def test_demitir_arquiva(self):
        hiring.hire(self.ficha())
        self.assertTrue(hiring.fire("revisor")[0])
        self.assertFalse((hiring.AGENTS_DIR / "revisor.md").exists())
        self.assertEqual(len(list(hiring.FIRED_DIR.glob("revisor-*.md"))), 1)
        self.assertFalse(hiring.fire("Explore")[0])


if __name__ == "__main__":
    unittest.main()
