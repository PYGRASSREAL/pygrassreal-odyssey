import http.server
import socketserver
import threading
import os
import sys

DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

def serve_on_port(port):
    try:
        with ThreadingServer(('0.0.0.0', port), NoCacheHTTPRequestHandler) as httpd:
            print(f"[Ready] Serving PyGrassReal Odyssey at http://localhost:{port}")
            httpd.serve_forever()
    except Exception as e:
        print(f"[Warning] Port {port} could not be bound: {e}")

if __name__ == '__main__':
    ports = [4173, 4137]
    threads = []
    for p in ports:
        t = threading.Thread(target=serve_on_port, args=(p,), daemon=True)
        t.start()
        threads.append(t)
    
    print("PyGrassReal Odyssey Multi-Port Server is active on:")
    for p in ports:
        print(f"  👉 http://localhost:{p}")
    
    for t in threads:
        t.join()
