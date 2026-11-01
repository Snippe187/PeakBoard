package de.peakverse.peakboard;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Wandelt Anzeige-Text in Abschnitte (Text, Farbe, Stil) um. Dieselbe Umwandlung dient dem echten Scoreboard und der Vorschau im Web, damit beide
 * gleich aussehen. Bukkit-frei.
 * <p>
 * Erlaubt: {@code &a} / {@code §a} (Farben und Stile wie in Minecraft), {@code &#ff8800}, {@code <red>}, {@code <#ff8800>}, {@code <b> <i> <u> <st> <obf>}
 * (mit {@code </b>} usw. zum Ausschalten), {@code <reset>}, {@code <gradient:rot:blau>...</gradient>} und {@code <rainbow>...</rainbow>}.
 * Unbekannte Tags bleiben als Text stehen. Klick- und Hover-Aktionen gibt es bewusst nicht.
 */
public final class Fmt {
    public static final int B = 1, I = 2, U = 4, S = 8, O = 16;

    /** Ein Stueck Text mit einheitlichem Aussehen. {@code color} ist RGB oder -1 fuer "Standard". */
    public record Span(String text, int color, int flags) { }

    private static final Map<String, Integer> NAMED = Map.ofEntries(
            Map.entry("black", 0x000000), Map.entry("dark_blue", 0x0000AA), Map.entry("dark_green", 0x00AA00), Map.entry("dark_aqua", 0x00AAAA),
            Map.entry("dark_red", 0xAA0000), Map.entry("dark_purple", 0xAA00AA), Map.entry("gold", 0xFFAA00), Map.entry("gray", 0xAAAAAA),
            Map.entry("dark_gray", 0x555555), Map.entry("blue", 0x5555FF), Map.entry("green", 0x55FF55), Map.entry("aqua", 0x55FFFF),
            Map.entry("red", 0xFF5555), Map.entry("light_purple", 0xFF55FF), Map.entry("yellow", 0xFFFF55), Map.entry("white", 0xFFFFFF));
    private static final String LEGACY = "0123456789abcdef";
    private static final int[] LEGACY_RGB = {0x000000, 0x0000AA, 0x00AA00, 0x00AAAA, 0xAA0000, 0xAA00AA, 0xFFAA00, 0xAAAAAA, 0x555555, 0x5555FF, 0x55FF55, 0x55FFFF,
            0xFF5555, 0xFF55FF, 0xFFFF55, 0xFFFFFF};
    /** Deutsche Farbnamen, damit {@code <gradient:rot:blau>} geht. */
    private static final Map<String, String> DE = Map.ofEntries(Map.entry("schwarz", "black"), Map.entry("dunkelblau", "dark_blue"), Map.entry("dunkelgruen", "dark_green"),
            Map.entry("dunkelgrün", "dark_green"), Map.entry("tuerkis", "dark_aqua"), Map.entry("türkis", "dark_aqua"), Map.entry("dunkelrot", "dark_red"),
            Map.entry("lila", "dark_purple"), Map.entry("gold", "gold"), Map.entry("grau", "gray"), Map.entry("dunkelgrau", "dark_gray"), Map.entry("blau", "blue"),
            Map.entry("gruen", "green"), Map.entry("grün", "green"), Map.entry("hellblau", "aqua"), Map.entry("rot", "red"), Map.entry("rosa", "light_purple"),
            Map.entry("gelb", "yellow"), Map.entry("weiss", "white"), Map.entry("weiß", "white"));

    private Fmt() { }

    /** Der reine Text ohne Farben und Stile. */
    public static String plain(List<Span> spans) {
        StringBuilder sb = new StringBuilder();
        for (Span s : spans) sb.append(s.text());
        return sb.toString();
    }

    public static List<Span> parse(String text) {
        List<Span> out = new ArrayList<>();
        parseInto(text == null ? "" : text, new State(), out, 0);
        return merge(out);
    }

    private static final class State {
        int color = -1;
        int flags;

        State copy() {
            State s = new State();
            s.color = color;
            s.flags = flags;
            return s;
        }
    }

    private static void parseInto(String t, State st, List<Span> out, int depth) {
        StringBuilder buf = new StringBuilder();
        int i = 0, n = t.length();
        while (i < n) {
            char c = t.charAt(i);
            if ((c == '&' || c == '§') && i + 1 < n) {
                char k = Character.toLowerCase(t.charAt(i + 1));
                if (k == '#' && isHex(t, i + 2, 6)) {
                    flush(buf, st, out);
                    st.color = Integer.parseInt(t.substring(i + 2, i + 8), 16);
                    st.flags = 0;
                    i += 8;
                    continue;
                }
                int idx = LEGACY.indexOf(k);
                if (idx >= 0) {
                    flush(buf, st, out);
                    st.color = LEGACY_RGB[idx];
                    st.flags = 0;
                    i += 2;
                    continue;
                }
                int flag = switch (k) { case 'l' -> B; case 'o' -> I; case 'n' -> U; case 'm' -> S; case 'k' -> O; default -> 0; };
                if (flag != 0) {
                    flush(buf, st, out);
                    st.flags |= flag;
                    i += 2;
                    continue;
                }
                if (k == 'r') {
                    flush(buf, st, out);
                    st.color = -1;
                    st.flags = 0;
                    i += 2;
                    continue;
                }
            }
            if (c == '<' && depth < 4) {
                int close = t.indexOf('>', i + 1);
                if (close > i && close - i <= 60) {
                    String tag = t.substring(i + 1, close).trim().toLowerCase(Locale.ROOT);
                    int next = applyTag(tag, t, close + 1, st, buf, out, depth);
                    if (next >= 0) {
                        i = next;
                        continue;
                    }
                }
            }
            buf.append(c);
            i++;
        }
        flush(buf, st, out);
    }

    /** Wendet ein Tag an. @return die Stelle im Text, an der es weitergeht, oder -1, wenn es kein bekanntes Tag war (dann bleibt es Text) */
    private static int applyTag(String tag, String t, int after, State st, StringBuilder buf, List<Span> out, int depth) {
        boolean closing = tag.startsWith("/");
        String name = closing ? tag.substring(1) : tag;
        int colon = name.indexOf(':');
        String head = colon < 0 ? name : name.substring(0, colon);
        if (!closing && (head.equals("gradient") || head.equals("rainbow"))) {
            String closeTag = "</" + head + ">";
            int end = t.toLowerCase(Locale.ROOT).indexOf(closeTag, after);
            String inner = end < 0 ? t.substring(after) : t.substring(after, end);
            List<Integer> stops = new ArrayList<>();
            if (head.equals("gradient")) {
                for (String p : name.substring(colon < 0 ? name.length() : colon + 1).split(":")) {
                    int rgb = colorOf(p.trim());
                    if (rgb >= 0) stops.add(rgb);
                }
                if (stops.size() < 2) return -1;
            }
            flush(buf, st, out);
            List<Span> innerSpans = new ArrayList<>();
            State inner0 = st.copy();
            parseInto(inner, inner0, innerSpans, depth + 1);
            innerSpans = merge(innerSpans);
            int total = 0;
            for (Span s : innerSpans) total += s.text().codePointCount(0, s.text().length());
            int idx = 0;
            for (Span s : innerSpans) {
                for (int off = 0; off < s.text().length(); ) {
                    int cp = s.text().codePointAt(off);
                    off += Character.charCount(cp);
                    double pos = total <= 1 ? 0 : idx / (double) (total - 1);
                    int rgb = head.equals("gradient") ? lerp(stops, pos) : rainbow(total <= 1 ? 0 : idx / (double) total);
                    out.add(new Span(new String(Character.toChars(cp)), rgb, s.flags()));
                    idx++;
                }
            }
            return end < 0 ? t.length() : end + closeTag.length();
        }
        if (head.equals("reset") && !closing) {
            flush(buf, st, out);
            st.color = -1;
            st.flags = 0;
            return after;
        }
        int flag = switch (head) {
            case "b", "bold" -> B;
            case "i", "italic", "em" -> I;
            case "u", "underlined" -> U;
            case "st", "strikethrough" -> S;
            case "obf", "obfuscated" -> O;
            default -> 0;
        };
        if (flag != 0 && colon < 0) {
            flush(buf, st, out);
            if (closing) st.flags &= ~flag;
            else st.flags |= flag;
            return after;
        }
        int rgb = colorOf(head);
        if (rgb >= 0 && colon < 0) {
            flush(buf, st, out);
            st.color = closing ? -1 : rgb;
            return after;
        }
        return -1;
    }

    private static int colorOf(String name) {
        if (name.startsWith("#") && name.length() == 7 && isHex(name, 1, 6)) return Integer.parseInt(name.substring(1), 16);
        Integer v = NAMED.get(name);
        if (v == null && DE.containsKey(name)) v = NAMED.get(DE.get(name));
        return v == null ? -1 : v;
    }

    private static boolean isHex(String s, int from, int len) {
        if (from + len > s.length()) return false;
        for (int i = from; i < from + len; i++) if (Character.digit(s.charAt(i), 16) < 0) return false;
        return true;
    }

    private static int lerp(List<Integer> stops, double pos) {
        double scaled = pos * (stops.size() - 1);
        int a = Math.min((int) Math.floor(scaled), stops.size() - 2);
        double f = scaled - a;
        int c1 = stops.get(a), c2 = stops.get(a + 1);
        int r = (int) Math.round(((c1 >> 16) & 255) * (1 - f) + ((c2 >> 16) & 255) * f);
        int g = (int) Math.round(((c1 >> 8) & 255) * (1 - f) + ((c2 >> 8) & 255) * f);
        int b = (int) Math.round((c1 & 255) * (1 - f) + (c2 & 255) * f);
        return (r << 16) | (g << 8) | b;
    }

    private static int rainbow(double hue) {
        return java.awt.Color.HSBtoRGB((float) hue, 0.75f, 1f) & 0xFFFFFF;
    }

    private static void flush(StringBuilder buf, State st, List<Span> out) {
        if (buf.length() == 0) return;
        out.add(new Span(buf.toString(), st.color, st.flags));
        buf.setLength(0);
    }

    private static List<Span> merge(List<Span> in) {
        List<Span> out = new ArrayList<>();
        for (Span s : in) {
            if (s.text().isEmpty()) continue;
            if (!out.isEmpty()) {
                Span last = out.get(out.size() - 1);
                if (last.color() == s.color() && last.flags() == s.flags()) {
                    out.set(out.size() - 1, new Span(last.text() + s.text(), s.color(), s.flags()));
                    continue;
                }
            }
            out.add(s);
        }
        return out;
    }
}
