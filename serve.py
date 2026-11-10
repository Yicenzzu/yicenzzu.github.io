#!/usr/bin/env python3
"""Local preview server with SPA fallback for clean URLs.

Run:
    python serve.py 8000
Then open http://127.0.0.1:8000/
"""

import http.server
import os
import socketserver
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        file_path = self.translate_path(path)

        # Serve index.html for route-like paths such as /about/ or /posts/slug/.
        if not os.path.exists(file_path) and "." not in os.path.basename(path):
            self.path = "/index.html"

        return super().do_GET()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with Server(("127.0.0.1", port), Handler) as httpd:
        print(f"Serving at http://127.0.0.1:{port}/")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
