#!/usr/bin/env python3
import http.server
import socketserver
import socket
import os
import threading
import time
import webbrowser  # 用于可选的自动打开浏览器

# --- 配置 ---
PORT = 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))  # 使用脚本所在目录
AUTO_OPEN_BROWSER = False  # 设置为 True 以自动打开浏览器
# --- /配置 ---

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] GET request: {self.path}")
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

def get_local_ip():
    """获取局域网IP地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))  # Google DNS
        local_ip = s.getsockname()[0]
    except socket.error:
        local_ip = '127.0.0.1'
    finally:
        s.close()
    return local_ip

def start_server():
    os.chdir(DIRECTORY)  # 确保服务器在正确的目录中运行
    Handler = MyHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"服务器将在 {get_local_ip()}:{PORT} 提供服务")
        if AUTO_OPEN_BROWSER:
            threading.Timer(1, webbrowser.open_new_tab, [f"http://{get_local_ip()}:{PORT}"]).start()
        try:
            httpd.serve_forever()  # 持续运行服务器
        except KeyboardInterrupt:
            print("\n服务器已停止")

if __name__ == "__main__":
    start_server()