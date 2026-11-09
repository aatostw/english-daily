"""Before each release: bump the version so phones never mix old and new files.
Sets eel-shell-vN in sw.js and ?v=N on every css/js link in index.html.
Usage: python3 tools/release.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
sw = (root / "sw.js").read_text()
n = int(re.search(r'eel-shell-v(\d+)', sw).group(1)) + 1
(root / "sw.js").write_text(re.sub(r'eel-shell-v\d+', "eel-shell-v%d" % n, sw))
html = (root / "index.html").read_text()
html = re.sub(r'((?:href|src)="(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=\d+)?"', r'\1?v=%d"' % n, html)
(root / "index.html").write_text(html)
print("version", n)
