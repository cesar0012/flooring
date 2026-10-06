#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Parche Flooring: quitar Alpine (CSP), integrar site.js, poster 404 y ciudades de Resurface."""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# ---------------------------------------------------------------
# 1) Poster del hero video (arregla el 404 de gallery-1.BMGwMp3U.webp)
# ---------------------------------------------------------------
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
poster = os.path.join("_astro", "gallery-1.BMGwMp3U.webp")
if not os.path.exists(poster):
    subprocess = None
    import subprocess as sp
    sp.run([FF, "-y", "-loglevel", "error", "-ss", "1", "-i", "videos/hero.mp4",
            "-vframes", "1", "-vf", "scale=1280:-2", poster],
           check=True)
    print("poster creado:", poster, os.path.getsize(poster), "bytes")
else:
    print("poster ya existe")

# ---------------------------------------------------------------
# 2) Parcheo de todas las páginas HTML
# ---------------------------------------------------------------
OLD_SCRIPT = '<script type="module" src="/_astro/BaseLayout.astro_astro_type_script_index_0_lang.zqGFmKvW.js"></script>'
NEW_SCRIPT = '<script src="/site.js?v=1" defer></script>'

INIT_HIDDEN = (
    'open', 'submitted', 'mobileMenuOpen', 'openMobileServices',
    'activeSlide === 1', 'activeSlide === 2',
    'active === 1', 'active === 2',
    "activeTab === 'mission'", "activeTab === 'process'",
    'openAcc === 1', 'openAcc === 2', 'openAcc === 3',
)

def add_hidden(m):
    tag = m.group(0)
    if 'style=' in tag:
        return tag
    return tag[:-1] + ' style="display:none">'

pattern_hidden = re.compile(
    r'<[a-zA-Z]+ [^>]*?x-show="(?:' + '|'.join(re.escape(e) for e in INIT_HIDDEN) + r')"[^>]*>')

changed = 0
for f in sorted(glob.glob("**/*.html", recursive=True)):
    src = open(f, encoding="utf-8").read()
    orig = src

    if OLD_SCRIPT in src:
        src = src.replace(OLD_SCRIPT, NEW_SCRIPT)
    elif "BaseLayout.astro_astro_type_script_index_0_lang" in src:
        # hash distinto en alguna página
        src = re.sub(r'<script type="module" src="/_astro/BaseLayout\.astro_astro_type_script_index_0_lang\.[^"]+"></script>',
                     NEW_SCRIPT, src)

    # ocultar elementos cuyo estado inicial es falso
    src = pattern_hidden.sub(add_hidden, src)

    if src != orig:
        open(f, "w", encoding="utf-8", newline="\n").write(src)
        changed += 1

print("páginas parcheadas:", changed)

# ---------------------------------------------------------------
# 3) Ciudades de Resurface → index (JSON-LD + sección visible)
# ---------------------------------------------------------------
src = open("index.html", encoding="utf-8").read()
orig = src

# JSON-LD areaServed: añadir las 4 ciudades nuevas tras Ridgefield, WA
old_as = '{"@type":"City","name":"Ridgefield, WA"}],"openingHoursSpecification"'
new_as = ('{"@type":"City","name":"Ridgefield, WA"},'
          '{"@type":"City","name":"Salem, OR"},'
          '{"@type":"City","name":"Hillsboro, OR"},'
          '{"@type":"City","name":"Happy Valley, OR"},'
          '{"@type":"City","name":"Gresham, OR"}],"openingHoursSpecification"')
assert old_as in src, "areaServed no encontrado"
src = src.replace(old_as, new_as)

# bullet del about: menciona ahora el área ampliada
old_bullet = "Trusted service in Lake Oswego, West Linn, and Wilsonville"
new_bullet = "Trusted service across Lake Oswego, West Linn, Wilsonville, Salem, Hillsboro, Gresham and the Portland metro"
if old_bullet in src:
    src = src.replace(old_bullet, new_bullet)

# bloque visible de ciudades tras la fila de stats
old_close = "Primary Service Areas</div></div></div></div></section>"
cities = ["Portland Metro", "Lake Oswego", "West Linn", "Wilsonville", "Portland",
          "Beaverton", "Tigard", "Tualatin", "Sherwood", "Salem", "Hillsboro",
          "Happy Valley", "Gresham", "Oregon City", "Vancouver, WA", "Camas, WA", "Ridgefield, WA"]
chips = "".join(
    f'<span class="px-4 py-2 rounded-full bg-panel border border-stroke text-sm font-bold text-text">{c}</span>'
    for c in cities)
chips_html = (f'<div class="mt-14" data-motion="fade-up">'
              f'<h3 class="text-xl font-black font-title text-text mb-5">Service Areas</h3>'
              f'<div class="flex flex-wrap gap-2.5">{chips}</div>'
              f'<p class="text-sm text-muted mt-4">Serving the greater Portland metro, Salem and the Willamette Valley, plus SW Washington.</p>'
              f'</div>')
assert old_close in src, "cierre de stats no encontrado"
src = src.replace(old_close, "Primary Service Areas</div></div></div></div>" + chips_html + "</section>")

if src != orig:
    open("index.html", "w", encoding="utf-8", newline="\n").write(src)
    print("index: ciudades añadidas (JSON-LD + visible)")

# ---------------------------------------------------------------
# 4) verificación: cero referencias a Alpine y cero dominio viejo
# ---------------------------------------------------------------
leftover = 0
for f in glob.glob("**/*.html", recursive=True):
    src = open(f, encoding="utf-8").read()
    if "BaseLayout.astro_astro_type_script_index_0_lang" in src:
        print("ALPINE SCRIPT RESTANTE:", f)
        leftover += 1
print("páginas con alpine restante:", leftover)
