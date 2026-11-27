#!/usr/bin/env python3
"""Finit les images brutes de Codex.
Usage : python finir.py PROMPTS_JSON DOSSIER_BRUT DOSSIER_SORTIE [fichier ...]
- recadre (centre, cover) puis redimensionne à la taille exacte demandée ;
- si detourer : fond magenta #FF00FF -> transparent (tolérance + bord adouci + suppression du halo rose) ;
- si raccord: N (dans le JSON) ou RACCORD="nom:N" (environnement), fond les N px des bords gauche/droite (panoramas en boucle) ;
- enregistre <fichier>.webp qualité 85, ou au chemin « sortie » du JSON (.png accepté, sous-dossiers créés).
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import os
# RACCORD="ciel_a:128,ciel_b:128" : fond les bords gauche/droite de ces images
RACCORD = dict((k, int(v)) for k, v in (e.split(":") for e in os.environ.get("RACCORD", "").split(",") if e))
TOL_DUR, TOL_DOUX = 45.0, 95.0  # distance RGB au magenta : <dur = transparent, >doux = opaque

def cover(img, w, h):
    """Recadre sans déformer. Panoramas (largeur >= 3x hauteur) : on garde le bas (ligne d'horizon)."""
    sw, sh = img.size
    r = max(w / sw, h / sh)
    img = img.resize((round(sw * r), round(sh * r)), Image.LANCZOS)
    l = (img.width - w) // 2
    t = img.height - h if w >= 3 * h else (img.height - h) // 2
    return img.crop((l, t, l + w, t + h))

def detourer(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # distance au magenta pur
    d = np.sqrt((255 - r) ** 2 + g ** 2 + (255 - b) ** 2)
    alpha = np.clip((d - TOL_DUR) / (TOL_DOUX - TOL_DUR), 0, 1)
    # ne détoure que le magenta relié au bord : un sujet rose/magenta au centre reste opaque
    proche = Image.fromarray(((d < TOL_DUR) * 255).astype(np.uint8))
    hh, ww = d.shape
    for x, y in [(x, 0) for x in range(0, ww, 8)] + [(x, hh - 1) for x in range(0, ww, 8)] + \
                [(0, y) for y in range(0, hh, 8)] + [(ww - 1, y) for y in range(0, hh, 8)]:
        if proche.getpixel((x, y)) == 255: ImageDraw.floodfill(proche, (x, y), 128)
    # + les poches de magenta quasi pur enfermées dans le sujet (entre deux pièces, sous un bras…)
    proche = Image.fromarray(np.where((np.asarray(proche) == 128) | (d < 25), 128, 0).astype(np.uint8))
    fond = np.asarray(proche.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(3))) > 0
    alpha = np.where(fond, alpha, 1.0)
    # adoucissement léger du bord
    am = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(am).astype(np.float32) / 255
    alpha[d < TOL_DUR * 0.8] = 0
    # dé-contamination : retire la part de magenta mélangée dans les pixels de bord
    mag = np.array([255, 0, 255], np.float32)
    bord = (alpha > 0) & (alpha < 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        rec = (a - (1 - alpha[..., None]) * mag) / np.maximum(alpha[..., None], 1e-3)
    a = np.where(bord[..., None], np.clip(rec, 0, 255), a)
    # anti-halo : près du fond (2 px), retire la teinte magenta résiduelle (r et b au-dessus de g)
    pres = np.asarray(Image.fromarray((fond * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    zone = pres & (alpha > 0)
    spill = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    lim = zone & (spill > 10)
    a[..., 0] = np.where(lim, a[..., 0] - (spill - 10), a[..., 0])
    a[..., 2] = np.where(lim, a[..., 2] - (spill - 10), a[..., 2])
    # bouche les petits trous (pixels du sujet presque magenta) : fermeture 3x3 du masque,
    # et les pixels rebouchés prennent la couleur médiane de leurs voisins opaques
    m = Image.fromarray((alpha * 255).astype(np.uint8))
    ferme = np.asarray(m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
    trou = ferme > alpha + 0.5
    if trou.any():
        opaque = np.where((alpha > 0.9)[..., None], a, 0).astype(np.uint8)
        med = np.asarray(Image.fromarray(opaque).filter(ImageFilter.MaxFilter(3))).astype(np.float32)
        a[trou] = med[trou]
        alpha = np.maximum(alpha, ferme)
    # dernière passe : à moins de 3 px de la transparence, un pixel resté presque magenta est du fond
    d2 = np.sqrt((255 - a[..., 0]) ** 2 + a[..., 1] ** 2 + (255 - a[..., 2]) ** 2)
    transp = Image.fromarray(((alpha < 0.5) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    alpha = np.where((np.asarray(transp) > 0) & (d2 < 80) & (np.abs(a[..., 0] - a[..., 2]) < 30), 0.0, alpha)
    # puis, sur 2 px de bord, les mélanges sujet + magenta (r ≈ b, tous deux nettement au-dessus de g)
    # deviennent transparents : les griser laisserait un contour sombre sur fond clair
    bande = (np.asarray(Image.fromarray(((alpha < 0.5) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0) & (alpha >= 0.5)
    sp = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    mel = bande & (np.abs(a[..., 0] - a[..., 2]) < 30) & (sp > 25)
    alpha = np.where(mel, 0.0, alpha)
    # sous les pixels transparents, remplace le magenta par la couleur du sujet voisin :
    # sinon le sous-échantillonnage des couleurs du WebP fait baver un liseré rose sur le bord
    poids = (alpha > 0.5).astype(np.float32)
    def flou(x, r):  # flou boîte séparable (numpy), rayon r
        for ax in (0, 1):
            p_ = np.pad(x, [(r + 1, r) if i == ax else (0, 0) for i in range(2)], mode="edge")
            c = np.cumsum(p_, axis=ax)
            x = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
        return x
    for r in (2, 6, 18):
        wsum = flou(poids, r)
        if (wsum > 1e-4).any():
            for c in range(3):
                col = flou(a[..., c] * poids, r) / np.maximum(wsum, 1e-4)
                a[..., c] = np.where((alpha <= 0.5) & (wsum > 1e-4) & (poids == 0), col, a[..., c])
            poids = np.maximum(poids, (wsum > 1e-4).astype(np.float32) * (alpha <= 0.5))
    out = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out)

def raccorder(img, bande):
    """Rend une image raccordable gauche/droite : les `bande` px de droite sont fondus dans
    ceux de gauche puis retirés ; l'image est ensuite ramenée à sa largeur d'origine."""
    a = np.asarray(img).astype(np.float32); h, w = a.shape[:2]
    t = np.linspace(0, 1, bande)[None, :, None]
    out = a[:, : w - bande].copy()
    out[:, :bande] = a[:, w - bande:] * (1 - t) + a[:, :bande] * t
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)

def main():
    js, brut, sortie, *noms = sys.argv[1:]
    d = json.load(open(js)); Path(sortie).mkdir(parents=True, exist_ok=True)
    for im in d["images"]:
        if noms and im["fichier"] not in noms: continue
        src = Path(brut) / f"{im['fichier']}.png"
        if not src.exists(): print("absent", src); continue
        w, h = map(int, im["taille"].split("x"))
        img = cover(Image.open(src).convert("RGB"), w, h)
        # détourer d'abord : fondre les bords avant mélangerait le magenta au sujet
        if im.get("detourer"): img = detourer(img)
        bande = im.get("raccord") or RACCORD.get(im["fichier"])
        if bande: img = raccorder(img, int(bande))
        dst = Path(sortie) / im.get("sortie", f"{im['fichier']}.webp")
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.suffix == ".png": img.save(dst, "PNG", optimize=True)
        else: img.save(dst, "WEBP", quality=85, method=6)
        print(f"{dst.name} {w}x{h} {dst.stat().st_size // 1024} Ko")

if __name__ == "__main__":
    main()
