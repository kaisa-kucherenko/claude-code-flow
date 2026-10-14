#!/usr/bin/python3
"""The break screen /timer opens when the time is up: a banner is too easy to miss.

The persona's title and phrase come from timer.sh; colours and GIFs from
persona/breaks.json and persona/breaks/*.gif, the type from fonts/. The close
button unlocks after a few seconds, so a reflexive Enter mid-typing cannot
dismiss it unseen.
  break.py <plugin-root> <title> <phrase>
"""
# The system interpreter on purpose: PyGObject ships as a distro package (python3-gi)
# and is missing from pyenv or venv interpreters
import ctypes
import json
import math
import os
import random
import sys
from dataclasses import dataclass
from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("GdkX11", "3.0")
gi.require_foreign("cairo")
import cairo  # noqa: E402
from gi.repository import Gdk, GdkPixbuf, GdkX11, GLib, Gtk, Pango  # noqa: E402

UNLOCK_SECONDS = 10
DEFAULT_COLOURS = {"background": "#1A2140", "text": "#DDE1F0", "accent": "#F2C94C"}
# Room around the card for its shadow in window mode: the 40px blur, pushed 16px down
SHADOW_MARGIN = {"start": 40, "top": 24, "end": 40, "bottom": 56}
# Upscaling a 480px GIF further than this turns it to mush
GIF_MAX_UPSCALE = 1.5
FADE_MS = 180


@dataclass(frozen=True)
class Tier:
    name: str
    card: tuple[int, int]
    card_no_gif: tuple[int, int]
    gif_box: tuple[int, int]
    phrase_width: int
    phrase_width_no_gif: int
    phrase_line: int
    ornament: tuple[int, int, float]


# The bundled GIFs are cut to fit 480×270, so tier M shows them and their burned-in subtitles unscaled
TIER_M = Tier("tier-m", (800, 520), (640, 320), (480, 270), 580, 520, 25, (96, 12, 3.0))
TIER_L = Tier("tier-l", (1040, 700), (820, 400), (640, 360), 780, 660, 30, (120, 14, 3.5))


def plugin_option(root: Path, key: str, default: str) -> str:
    """A /config pick: systemd starts the timer outside any session, so settings.json is read too."""
    value = os.environ.get(f"CLAUDE_PLUGIN_OPTION_{key.upper()}")
    if value:
        return value
    name = json.loads((root / ".claude-plugin/plugin.json").read_text())["name"]
    settings = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude")) / "settings.json"
    try:
        configs = json.loads(settings.read_text()).get("pluginConfigs", {})
    except (OSError, ValueError):
        return default
    for plugin, config in configs.items():
        options = config.get("options", {}) if plugin.startswith(f"{name}@") else {}
        if key in options:
            return options[key]
    return default


def load_colours(root: Path) -> dict[str, str]:
    try:
        screen = json.loads((root / "persona/breaks.json").read_text()).get("screen", {})
    except (OSError, ValueError):
        screen = {}
    # A typo in breaks.json would otherwise break the stylesheet and the screen with it
    return DEFAULT_COLOURS | {k: v for k, v in screen.items() if k in DEFAULT_COLOURS and Gdk.RGBA().parse(str(v))}


def load_fonts(root: Path) -> None:
    """Pango on Ubuntu 22.04 cannot take a font file, so fontconfig is told about the bundled ones."""
    try:
        fontconfig = ctypes.CDLL("libfontconfig.so.1")
    except OSError:
        return
    for font in sorted((root / "fonts").glob("*.ttf")):
        fontconfig.FcConfigAppFontAddFile(None, str(font).encode())


def pick_gif(root: Path) -> Path | None:
    gifs = sorted((root / "persona/breaks").glob("*.gif"))
    return random.choice(gifs) if gifs else None


def typeset(text: str) -> str:
    """breaks.json is typed with a straight apostrophe, which reads as a typewriter tick."""
    return text.replace("'", "’")


def rgba(spec: str, alpha: float = 1.0) -> Gdk.RGBA:
    colour = Gdk.RGBA()
    colour.parse(spec)
    colour.alpha = alpha
    return colour


def rounded_rect(cr: cairo.Context, x: float, y: float, w: float, h: float, r: float) -> None:
    cr.new_sub_path()
    cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    cr.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    cr.close_path()


def stylesheet(colours: dict[str, str]) -> bytes:
    # Gold and navy are near complements: any partial mix of the two turns grey-olive,
    # so tints mix navy with the text colour or black and gold appears only solid
    return f"""
@define-color bg {colours["background"]};
@define-color text {colours["text"]};
@define-color accent {colours["accent"]};
@define-color card_top mix(@bg, @text, 0.05);
@define-color card_bottom mix(@bg, black, 0.18);
@define-color well mix(@bg, black, 0.35);
@define-color backdrop mix(@bg, black, 0.45);
@define-color accent_hover mix(@accent, white, 0.22);
@define-color accent_pressed mix(@accent, black, 0.06);

window.break-screen.window-mode {{ background-color: transparent; }}
window.break-screen.fullscreen-mode {{
  background-color: @backdrop;
  background-image: radial-gradient(ellipse at 50% 35%, alpha(@text, 0.06), transparent 70%);
}}

.card {{
  background-image: linear-gradient(to bottom, @card_top, @card_bottom);
  border: 1px solid alpha(@text, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35),
              inset 0 1px alpha(white, 0.04);
}}
.card.tier-l {{ border-radius: 16px; }}
.card.solid {{ border-radius: 0; box-shadow: none; }}

.title  {{ color: @accent; font-family: "Fira Sans Extra Condensed", "Ubuntu Condensed", "Ubuntu";
           font-weight: 600; font-size: 26px; letter-spacing: 1.5px; }}
.phrase {{ color: @text; font-family: "Fira Sans", "Ubuntu"; font-weight: 400;
           font-size: 20px; }}
.tier-l .title  {{ font-size: 32px; letter-spacing: 2px; }}
.tier-l .phrase {{ font-size: 24px; }}
.no-gif .phrase {{ font-size: 22px; }}
.tier-l.no-gif .phrase {{ font-size: 26px; }}

.tier-m .gif-frame {{ margin-top: 20px; }}  .tier-l .gif-frame {{ margin-top: 28px; }}
.tier-m .phrase    {{ margin-top: 20px; }}  .tier-l .phrase    {{ margin-top: 28px; }}
.tier-m button.return {{ margin-top: 24px; }} .tier-l button.return {{ margin-top: 32px; }}
.tier-m.no-gif .phrase {{ margin-top: 28px; }} .tier-l.no-gif .phrase {{ margin-top: 32px; }}
.tier-m.no-gif button.return {{ margin-top: 32px; }} .tier-l.no-gif button.return {{ margin-top: 36px; }}

.gif-frame {{ border-radius: 8px; background-color: @well;
              box-shadow: 0 8px 20px rgba(0,0,0,0.45); }}
.tier-l .gif-frame {{ border-radius: 10px; }}

button.return {{
  font-family: "Fira Sans", "Ubuntu"; font-weight: 500; font-size: 15px; letter-spacing: 0.2px;
  font-feature-settings: "tnum";
  min-height: 42px; min-width: 178px; padding: 0 20px;
  border-radius: 22px; border: 1px solid @accent;
  background-color: @accent; background-image: none;
  color: @bg; text-shadow: none; -gtk-icon-shadow: none;
  box-shadow: 0 4px 14px alpha(black, 0.40);
  outline-color: transparent;
  /* Short, because the frames between navy and gold are the olive mix */
  transition: background-color 160ms ease-out, color 160ms ease-out,
              border-color 160ms ease-out, box-shadow 160ms ease-out;
}}
button.return label {{ color: inherit; }}
button.return:hover {{ background-color: @accent_hover; border-color: @accent_hover; }}
button.return:active {{ background-color: @accent_pressed; border-color: @accent_pressed;
                        box-shadow: none; }}
button.return:focus {{ outline: 2px solid @accent_hover; outline-offset: 3px;
                       -gtk-outline-radius: 25px; }}
button.return:disabled, button.return:disabled label {{
  background-color: transparent; background-image: none;
  border-color: alpha(@text, 0.38); color: @text; box-shadow: none;
}}
.tier-l button.return {{ font-size: 17px; min-height: 50px; min-width: 218px;
                         border-radius: 26px; }}
.tier-l button.return:focus {{ -gtk-outline-radius: 29px; }}
""".encode()


class GifCanvas(Gtk.DrawingArea):
    """Plays a GIF clipped to rounded corners, which GTK3 CSS cannot do to an image."""

    def __init__(self, animation: GdkPixbuf.PixbufAnimation, box: tuple[int, int], radius: float, hairline: Gdk.RGBA):
        super().__init__()
        scale = min(box[0] / animation.get_width(), box[1] / animation.get_height(), GIF_MAX_UPSCALE)
        self.size = (max(1, round(animation.get_width() * scale)), max(1, round(animation.get_height() * scale)))
        self.radius = radius
        self.hairline = hairline
        self.frames = animation.get_iter(None)
        self.frame = self.scaled_frame()
        self.set_size_request(*self.size)
        self.connect("draw", self.on_draw)
        self.schedule_next()

    def scaled_frame(self) -> GdkPixbuf.Pixbuf:
        return self.frames.get_pixbuf().scale_simple(*self.size, GdkPixbuf.InterpType.BILINEAR)

    def schedule_next(self) -> None:
        delay = self.frames.get_delay_time()
        if delay >= 0:
            GLib.timeout_add(max(delay, 20), self.next_frame)

    def next_frame(self) -> bool:
        self.frames.advance(None)
        self.frame = self.scaled_frame()
        self.queue_draw()
        self.schedule_next()
        return False

    def on_draw(self, _widget: Gtk.Widget, cr: cairo.Context) -> bool:
        w, h = self.size
        rounded_rect(cr, 0, 0, w, h, self.radius)
        cr.save()
        cr.clip()
        Gdk.cairo_set_source_pixbuf(cr, self.frame, 0, 0)
        cr.paint()
        cr.restore()
        rounded_rect(cr, 0.5, 0.5, w - 1, h - 1, self.radius - 0.5)
        Gdk.cairo_set_source_rgba(cr, self.hairline)
        cr.set_line_width(1)
        cr.stroke()
        return False


class Ornament(Gtk.DrawingArea):
    """A chalk line ending in a gold spot: the halfway line and the ● the HUD counts penalties with."""

    def __init__(self, size: tuple[int, int, float], text: str, accent: str, mirrored: bool):
        super().__init__()
        self.radius = size[2]
        self.text = rgba(text)
        self.accent = rgba(accent)
        self.mirrored = mirrored
        self.set_size_request(size[0], size[1])
        self.set_valign(Gtk.Align.CENTER)
        self.connect("draw", self.on_draw)

    def on_draw(self, widget: Gtk.Widget, cr: cairo.Context) -> bool:
        w, h = widget.get_allocated_width(), widget.get_allocated_height()
        if self.mirrored:
            cr.translate(w, 0)
            cr.scale(-1, 1)
        r, t, a = self.radius, self.text, self.accent
        end = w - 2 * r - 4
        line = cairo.LinearGradient(0, 0, end, 0)
        line.add_color_stop_rgba(0, t.red, t.green, t.blue, 0)
        line.add_color_stop_rgba(1, t.red, t.green, t.blue, 0.4)
        cr.set_source(line)
        cr.set_line_width(1)
        cr.move_to(0, h / 2 + 0.5)
        cr.line_to(end, h / 2 + 0.5)
        cr.stroke()
        cr.arc(w - r - 1, h / 2, r, 0, 2 * math.pi)
        Gdk.cairo_set_source_rgba(cr, a)
        cr.fill()
        return False


class BreakScreen:
    def __init__(self, root: Path, title: str, phrase: str):
        self.colours = load_colours(root)
        self.title = typeset(title)
        self.phrase = typeset(phrase)
        self.fill_colour = self.mixed("background", "text", 0.18)
        self.animations = Gtk.Settings.get_default().props.gtk_enable_animations
        self.windows: list[Gtk.Window] = []
        self.buttons: list[Gtk.Button] = []
        self.progress = 0.0
        self.shown_left = UNLOCK_SECONDS
        self.unlocked = False

        css = Gtk.CssProvider()
        css.load_from_data(stylesheet(self.colours))
        screen = Gdk.Screen.get_default()
        Gtk.StyleContext.add_provider_for_screen(screen, css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        gif = pick_gif(root)
        try:
            self.animation = GdkPixbuf.PixbufAnimation.new_from_file(str(gif)) if gif else None
        except GLib.Error:
            self.animation = None

        display = Gdk.Display.get_default()
        primary = next((i for i in range(display.get_n_monitors()) if display.get_monitor(i).is_primary()), 0)
        fullscreen = plugin_option(root, "breakScreen", "window") == "fullscreen"
        # Fullscreen covers every monitor: a free one is where work quietly goes on
        monitors = list(range(display.get_n_monitors())) if fullscreen else [primary]
        for i in monitors:
            geometry = display.get_monitor(i).get_geometry()
            if fullscreen:
                big = geometry.width >= 1600 and geometry.height >= 900
                window = self.build_fullscreen(screen, i, TIER_L if big else TIER_M)
            else:
                window = self.build_window(screen, geometry)
            self.windows.append(window)
        # Mutter focuses the window shown last, and the primary monitor is where she types
        order = sorted(range(len(self.windows)), key=lambda n: monitors[n] == primary)
        for n in order:
            window = self.windows[n]
            if self.animations and screen.is_composited():
                Gtk.Widget.set_opacity(window, 0)
                window.add_tick_callback(self.fade_in, None)
            window.show_all()
            window.present_with_time(GdkX11.x11_get_server_time(window.get_window()))
        self.started = GLib.get_monotonic_time()
        GLib.timeout_add(40, self.tick)

    def mixed(self, a: str, b: str, f: float) -> Gdk.RGBA:
        ca, cb = rgba(self.colours[a]), rgba(self.colours[b])
        return Gdk.RGBA(ca.red + (cb.red - ca.red) * f, ca.green + (cb.green - ca.green) * f,
                        ca.blue + (cb.blue - ca.blue) * f, 1)

    def new_window(self, mode: str) -> Gtk.Window:
        window = Gtk.Window(title=self.title)
        window.get_style_context().add_class("break-screen")
        window.get_style_context().add_class(mode)
        window.set_decorated(False)
        window.set_keep_above(True)
        window.set_skip_taskbar_hint(True)
        window.connect("delete-event", self.on_delete)
        window.connect("key-press-event", self.on_key)
        return window

    def build_window(self, screen: Gdk.Screen, geometry: Gdk.Rectangle) -> Gtk.Window:
        window = self.new_window("window-mode")
        window.set_resizable(False)
        card, (w, h) = self.build_card(TIER_M)
        # Rounded corners need see-through pixels; without a compositor they would come out black
        rounded = screen.is_composited() and screen.get_rgba_visual() is not None
        margin = SHADOW_MARGIN if rounded else dict.fromkeys(SHADOW_MARGIN, 0)
        if rounded:
            window.set_visual(screen.get_rgba_visual())
            window.set_app_paintable(True)
        else:
            card.get_style_context().add_class("solid")
        card.set_margin_start(margin["start"])
        card.set_margin_end(margin["end"])
        card.set_margin_top(margin["top"])
        card.set_margin_bottom(margin["bottom"])
        window.add(card)
        full_w, full_h = w + margin["start"] + margin["end"], h + margin["top"] + margin["bottom"]
        window.set_default_size(full_w, full_h)
        window.move(geometry.x + (geometry.width - w) // 2 - margin["start"],
                    geometry.y + (geometry.height - h) // 2 - margin["top"])
        window.realize()
        # The shadow is decoration: clicks there belong to the window underneath
        window.input_shape_combine_region(cairo.Region(cairo.RectangleInt(margin["start"], margin["top"], w, h)))
        return window

    def build_fullscreen(self, screen: Gdk.Screen, monitor: int, tier: Tier) -> Gtk.Window:
        window = self.new_window("fullscreen-mode")
        card, _ = self.build_card(tier)
        card.set_halign(Gtk.Align.CENTER)
        card.set_valign(Gtk.Align.CENTER)
        window.add(card)
        window.realize()
        window.fullscreen_on_monitor(screen, monitor)
        return window

    def build_card(self, tier: Tier) -> tuple[Gtk.Box, tuple[int, int]]:
        with_gif = self.animation is not None
        size = tier.card if with_gif else tier.card_no_gif
        card = Gtk.Box()
        for cls in ("card", tier.name) + (() if with_gif else ("no-gif",)):
            card.get_style_context().add_class(cls)
        card.set_size_request(*size)

        stack = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        stack.set_halign(Gtk.Align.CENTER)
        stack.set_valign(Gtk.Align.CENTER)
        stack.set_hexpand(True)
        card.add(stack)

        row = Gtk.Box(spacing=16 if tier is TIER_M else 20)
        row.set_halign(Gtk.Align.CENTER)
        # Scoreboard capitals; GTK3 CSS has no text-transform
        heading = Gtk.Label(label=self.title.upper())
        heading.get_style_context().add_class("title")
        # Pango measures letter-spaced text narrower than it draws it, so an ellipsizing
        # label would cut even a short title; only one past the cap gets the ellipsis
        if len(self.title) > 28:
            heading.set_ellipsize(Pango.EllipsizeMode.END)
            heading.set_max_width_chars(28)
        row.add(Ornament(tier.ornament, self.colours["text"], self.colours["accent"], mirrored=False))
        row.add(heading)
        row.add(Ornament(tier.ornament, self.colours["text"], self.colours["accent"], mirrored=True))
        stack.add(row)

        frame = None
        if with_gif:
            frame = Gtk.Box()
            frame.get_style_context().add_class("gif-frame")
            frame.set_halign(Gtk.Align.CENTER)
            stack.add(frame)

        text = Gtk.Label(label=self.phrase)
        text.get_style_context().add_class("phrase")
        text.set_line_wrap(True)
        text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR)
        text.set_justify(Gtk.Justification.CENTER)
        text.set_lines(4)
        text.set_ellipsize(Pango.EllipsizeMode.END)
        width = tier.phrase_width if with_gif else tier.phrase_width_no_gif
        # The width request sets the floor and the 1-char cap keeps the natural width
        # from growing past it, so the phrase wraps at exactly this width
        text.set_size_request(width, -1)
        text.set_max_width_chars(1)
        text.set_halign(Gtk.Align.CENTER)
        if self.phrase.strip():
            stack.add(text)

        button = Gtk.Button(label=self.button_label())
        button.get_style_context().add_class("return")
        button.set_halign(Gtk.Align.CENTER)
        button.set_sensitive(False)
        button.connect("draw", self.draw_fill)
        button.connect("clicked", self.close)
        stack.add(button)
        self.buttons.append(button)

        if frame is not None:
            box_w, box_h = tier.gif_box
            # A long phrase takes height from the GIF, never from the fixed-size card
            extra = max(0, self.phrase_lines(text, width) - 2)
            if extra:
                shrink = max(0.3, (box_h - extra * tier.phrase_line) / box_h)
                box_w, box_h = round(box_w * shrink), round(box_h * shrink)
            radius = 8 if tier is TIER_M else 10
            frame.add(GifCanvas(self.animation, (box_w, box_h), radius,
                                rgba(self.colours["text"], 0.16)))
        return card, size

    @staticmethod
    def phrase_lines(label: Gtk.Label, width: int) -> int:
        layout = label.create_pango_layout(label.get_text())
        layout.set_width(width * Pango.SCALE)
        layout.set_wrap(Pango.WrapMode.WORD_CHAR)
        return layout.get_line_count()

    def button_label(self, left: int = UNLOCK_SECONDS) -> str:
        return f"Назад на поле · {left}" if left > 0 else "Назад на поле"

    def draw_fill(self, button: Gtk.Button, cr: cairo.Context) -> bool:
        """The locked pill fills up under its border and label as the seconds run out."""
        if self.unlocked or self.progress <= 0:
            return False
        w, h = button.get_allocated_width(), button.get_allocated_height()
        # The CSS margin-top sits inside the allocation; the pill is the bottom part of it
        pill_h = h - button.get_style_context().get_margin(Gtk.StateFlags.NORMAL).top
        top = h - pill_h
        cr.save()
        rounded_rect(cr, 1, top + 1, w - 2, pill_h - 2, (pill_h - 2) / 2)
        cr.clip()
        cr.rectangle(1, top + 1, (w - 2) * self.progress, pill_h - 2)
        Gdk.cairo_set_source_rgba(cr, self.fill_colour)
        cr.fill()
        cr.restore()
        return False

    def tick(self) -> bool:
        # One clock for the fill and the number, so the two never disagree
        elapsed = (GLib.get_monotonic_time() - self.started) / 1_000_000
        left = max(0, math.ceil(UNLOCK_SECONDS - elapsed))
        smooth = min(1.0, elapsed / UNLOCK_SECONDS)
        self.progress = smooth if self.animations else (UNLOCK_SECONDS - left) / UNLOCK_SECONDS
        for button in self.buttons:
            if left != self.shown_left:
                button.set_label(self.button_label(left))
            button.queue_draw()
        self.shown_left = left
        if left > 0:
            return True
        self.unlocked = True
        for window, button in zip(self.windows, self.buttons):
            button.set_sensitive(True)
            button.grab_focus()
            # GTK hides the focus ring until a key is pressed; the ring is what says Enter works now
            window.set_focus_visible(True)
        return False

    def fade_in(self, window: Gtk.Window, clock: Gdk.FrameClock, _data) -> bool:
        if not hasattr(window, "fade_start"):
            window.fade_start = clock.get_frame_time()
        t = min(1.0, (clock.get_frame_time() - window.fade_start) / (FADE_MS * 1000))
        Gtk.Widget.set_opacity(window, 1 - (1 - t) ** 3)
        return t < 1.0

    def on_delete(self, *_) -> bool:
        # The window manager would destroy just this one window and leave the process,
        # and the systemd unit waiting on it, running
        if self.unlocked:
            self.close()
        return True

    def on_key(self, _window: Gtk.Window, event: Gdk.EventKey) -> bool:
        if self.unlocked and event.keyval == Gdk.KEY_Escape:
            self.close()
            return True
        return False

    def close(self, *_) -> None:
        for window in self.windows:
            window.destroy()
        Gtk.main_quit()


def main() -> None:
    root, title, phrase = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    load_fonts(root)
    Gdk.set_allowed_backends("x11")
    if not Gtk.init_check()[0]:
        sys.exit("break.py: no display to open the break screen on")
    BreakScreen(root, title, phrase)
    Gtk.main()


if __name__ == "__main__":
    main()
