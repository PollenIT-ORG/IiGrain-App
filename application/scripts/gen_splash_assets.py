#!/usr/bin/env python3
"""
Single source of truth for the NATIVE splash-screen logo (iOS + Android).

The app shows a green leaf mark on a white background BEFORE React Native
starts, using each platform's native launch mechanism:

  * iOS     - LaunchScreen.storyboard -> "LeafLogo" imageset (leaf.png)
  * Android - androidx.core SplashScreen API -> @drawable/splash_icon

...and then JS re-draws the SAME leaf at the SAME size as the first RN frame
(`src/assets/images/splashLeaf.png`, rendered by SplashBackdrop), so the
native -> JS handoff is invisible. That third asset is generated here too, for
the same reason: all three must come from one master or the handoff flickers.

To change the branding in the future:

  1. Replace  branding/splash_master.png  with the new logo
     (square PNG, transparent background, logo roughly centered).
  2. Run:     python scripts/gen_splash_assets.py
  3. Rebuild both apps.

Requires Pillow (`pip install pillow`). Nothing is imported from the app.

Design / sizing rationale
-------------------------
* On-screen the leaf is TARGET_LEAF_DP tall on BOTH platforms so users cannot
  tell the two splashes apart. 67 dp/pt matches what iOS already shipped, and
  keeps the upscale factor from the master's native leaf resolution (150x181)
  under ~1.5x on the densest bucket, so the leaf never looks blurry.
* Android's SplashScreen API scales the icon drawable to fill a 288 dp icon
  slot, so the drawable is authored as a 288 dp canvas with the leaf sized to
  TARGET_LEAF_DP and centered (transparent margin = safe zone; the leaf stays
  well inside the circular mask applied on Android 12+, so it is never clipped).
* iOS scales the WHOLE imageset to fit the 160 pt image view, so the leaf is
  sized to TARGET_LEAF_DP within a 432 px canvas -> 67 pt on screen.
* Both backgrounds are pure white and the leaf is horizontally + vertically
  centered, giving identical proportions, padding, scale and alignment.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)  # C:\farmer-app\application
MASTER = os.path.join(APP, "branding", "splash_master.png")

TARGET_LEAF_DP = 67  # on-screen leaf height, identical on iOS + Android

# --- Android: SplashScreen API animated-icon drawable ------------------------
ANDROID_CANVAS_DP = 288  # the icon slot the OS fits the drawable into
ANDROID_DENSITIES = {
    "mdpi": 1.0,
    "hdpi": 1.5,
    "xhdpi": 2.0,
    "xxhdpi": 3.0,
    "xxxhdpi": 4.0,
}
ANDROID_RES = os.path.join(APP, "android", "app", "src", "main", "res")

# --- iOS: LaunchScreen.storyboard "LeafLogo" imageset ------------------------
IOS_CANVAS_PX = 432          # storyboard image view is 160 pt, aspect-fit
IOS_IMAGEVIEW_PT = 160
IOS_IMAGESET = os.path.join(
    APP, "ios", "iiGrain", "Images.xcassets", "LeafLogo.imageset"
)
IOS_LEAF_PNG = os.path.join(IOS_IMAGESET, "leaf.png")
IOS_CONTENTS_JSON = os.path.join(IOS_IMAGESET, "Contents.json")

# --- JS: the first React Native frame, drawn by SplashBackdrop --------------
# A square canvas whose height IS the leaf height, so `resizeMode="contain"`
# inside a TARGET_LEAF_DP box renders the leaf at exactly TARGET_LEAF_DP -
# pixel-identical to what the OS was showing a frame earlier.
JS_SCALE = 4  # authored at @4x so xxxhdpi / iPhone @3x never upscale
JS_LEAF_PNG = os.path.join(APP, "src", "assets", "images", "splashLeaf.png")

# An imageset without this manifest is silently skipped by actool: the asset
# never reaches Assets.car and the storyboard's "LeafLogo" reference resolves
# to nothing, so the launch screen comes up blank. It is written here rather
# than left to Xcode because nothing else in the pipeline creates it.
# No "scale" key = single-scale asset, which is what one 432 px canvas
# aspect-fitted into the storyboard's image view needs.
IOS_CONTENTS = """{
  "images" : [
    {
      "filename" : "leaf.png",
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  },
  "properties" : {
    "template-rendering-intent" : "original"
  }
}
"""


def load_tight_leaf():
    """Return the master cropped to its alpha bounding box (the leaf only)."""
    im = Image.open(MASTER).convert("RGBA")
    bbox = im.split()[3].getbbox()
    if bbox is None:
        raise SystemExit("Master has no visible pixels: " + MASTER)
    return im.crop(bbox)


def compose(leaf, canvas_px, leaf_h_px):
    """Scale `leaf` to leaf_h_px tall and center it on a transparent canvas."""
    lw, lh = leaf.size
    w = max(1, round(lw * (leaf_h_px / lh)))
    scaled = leaf.resize((w, leaf_h_px), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    canvas.paste(scaled, ((canvas_px - w) // 2, (canvas_px - leaf_h_px) // 2), scaled)
    return canvas


def main():
    leaf = load_tight_leaf()
    print(f"master leaf content: {leaf.size[0]}x{leaf.size[1]} px")

    # Android
    for name, scale in ANDROID_DENSITIES.items():
        canvas_px = round(ANDROID_CANVAS_DP * scale)
        leaf_px = round(TARGET_LEAF_DP * scale)
        out_dir = os.path.join(ANDROID_RES, f"drawable-{name}")
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, "splash_icon.png")
        img = compose(leaf, canvas_px, leaf_px)
        img.save(out, "PNG")
        up = leaf_px / leaf.size[1]
        print(f"  android/{name:8s} canvas={canvas_px:4d} leaf={leaf_px:4d}px "
              f"(scale x{up:.2f}) -> {out}")

    # iOS (universal single scale, matching the existing imageset layout)
    ios_leaf_px = round(TARGET_LEAF_DP * (IOS_CANVAS_PX / IOS_IMAGEVIEW_PT))
    ios_img = compose(leaf, IOS_CANVAS_PX, ios_leaf_px)
    os.makedirs(IOS_IMAGESET, exist_ok=True)
    ios_img.save(IOS_LEAF_PNG, "PNG")
    with open(IOS_CONTENTS_JSON, "w") as fh:
        fh.write(IOS_CONTENTS)
    print(f"  ios/leaf.png       canvas={IOS_CANVAS_PX} leaf={ios_leaf_px}px "
          f"-> on-screen {TARGET_LEAF_DP} pt -> {IOS_LEAF_PNG}")
    print(f"  ios/Contents.json  -> {IOS_CONTENTS_JSON}")

    # JS (first RN frame)
    js_px = TARGET_LEAF_DP * JS_SCALE
    compose(leaf, js_px, js_px).save(JS_LEAF_PNG, "PNG")
    print(f"  js/splashLeaf.png  canvas={js_px} leaf={js_px}px "
          f"(@{JS_SCALE}x of {TARGET_LEAF_DP} dp) -> {JS_LEAF_PNG}")

    print("done.")


if __name__ == "__main__":
    main()
