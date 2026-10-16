#!/usr/bin/env python3
"""Tiny write-only endpoint for tools/covers/index.html: POST /save?path=assets/images/work/... with the
file bytes as the body. Only .webp/.jpg files under assets/images/work/ can be written."""
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..'))
ALLOWED = re.compile(r'^assets/images/work/[a-z0-9-]+(/[a-z0-9-]+)?\.(webp|jpg)$')


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        rel = (parse_qs(url.query).get('path') or [''])[0]
        target = os.path.realpath(os.path.join(ROOT, rel))
        if url.path != '/save' or not ALLOWED.match(rel) or not target.startswith(ROOT + os.sep):
            self.send_response(400)
            self._cors()
            self.end_headers()
            return
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'wb') as f:
            f.write(data)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 4177), Handler).serve_forever()
