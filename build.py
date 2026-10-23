#!/usr/bin/env python3
"""Rebuild dist/rainier.bundle.js from js/*.js (no network or npm needed)."""
import re, sys, pathlib
root = pathlib.Path(__file__).parent
ORDER = ['config','astro','shaders','sky-gradient','river','weather','lightning',
         'clouds','precip','life','stage','parallax','scene','controls','timeline','main']
ver = re.search(r"version:\s*'([^']+)'", (root/'js/config.js').read_text()).group(1)
out = [f'// rainier v{ver} bundle', "import * as THREE from 'three';"]
local_import = re.compile(r"^import\s[^;]*?from\s+'\./[^']+';\s*$\n?", re.M)
three_import = re.compile(r"^import\s[^;]*?from\s+'three';\s*$\n?", re.M)
for name in ORDER:
    s = (root/f'js/{name}.js').read_text()
    had = bool(local_import.search(s) or three_import.search(s))
    s = local_import.sub('', s)
    s = three_import.sub('', s)
    if had:  # match the original bundler: one blank line where the imports were
        first, rest = s.split('\n', 1)
        s = first + '\n\n' + rest
    s = re.sub(r'^export\s+', '', s, flags=re.M)
    out.append(s.rstrip('\n'))
dest = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root/'dist/rainier.bundle.js'
dest.write_text('\n'.join(out) + '\n')
print('wrote', dest, dest.stat().st_size, 'bytes')
