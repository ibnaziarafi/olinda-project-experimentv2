"""Regression checks for text encoding and both public widget URL forms."""
import json
import re
import unittest
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]


class WidgetAssetTests(unittest.TestCase):
    def test_ui_text_is_encoding_neutral(self):
        view = (ROOT/'frontend/chatbot/js/ui/view.js').read_text(encoding='ascii')
        controller = (ROOT/'frontend/chatbot/js/core/widget.js').read_text(encoding='ascii')
        self.assertIn(r'Connecting\u2026', view)
        self.assertIn(r'I\u2019m', view)
        self.assertIn(r'couldn\u2019t', controller)
        for escape in (r'\u21bb', r'\u00d7', r'\u2191', r'\u2197'):
            self.assertIn(escape, view)

    def test_root_and_nested_embed_assets_resolve(self):
        rules = json.loads((ROOT/'vercel.json').read_text(encoding='utf-8'))['rewrites']
        def resolve(url):
            path = urlparse(url).path
            direct = ROOT/'frontend'/path.lstrip('/')
            if direct.is_file():
                return direct
            for rule in rules:
                source = rule['source']
                if ':path*' in source:
                    prefix = source.split(':path*')[0]
                    if path.startswith(prefix):
                        return ROOT/'frontend'/rule['destination'].replace(':path*',path[len(prefix):]).lstrip('/')
                elif source == path:
                    return ROOT/'frontend'/rule['destination'].lstrip('/')
            return direct
        for entry in ('https://widget.example/widget.js', 'https://widget.example/chatbot/widget.js'):
            queue = [entry]
            visited = set()
            while queue:
                url = queue.pop()
                if url in visited:
                    continue
                visited.add(url)
                file = resolve(url)
                self.assertTrue(file.is_file(), url)
                if file.suffix == '.js':
                    source = file.read_text(encoding='utf-8')
                    for relative in re.findall(r"(?:from\s+['\"]|new URL\(['\"])(\.{1,2}/[^'\"]+)", source):
                        queue.append(urljoin(url, relative))
        self.assertTrue(resolve('https://widget.example/styles/dashboard.css').is_file())


if __name__ == '__main__':
    unittest.main()
