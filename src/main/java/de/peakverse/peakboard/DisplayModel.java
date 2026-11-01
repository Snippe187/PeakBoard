package de.peakverse.peakboard;

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.List;

/**
 * Die Anzeige, die jeder Spieler rechts sieht: Seiten mit Titel (auch animiert) und Zeilen, die nach Zeit wechseln. Bukkit-frei und als JSON speicherbar.
 */
public final class DisplayModel {
    public static final int MAX_PAGES = 8, MAX_LINES = 15, MAX_TEXT = 120, MAX_TITLE_FRAMES = 12, MAX_TITLE = 60;
    private static final Gson GSON = new Gson();

    /** Eine Seite der Anzeige. */
    public static final class Page {
        public String name = "Seite";
        /** Bilder des Titels; mehrere Bilder ergeben eine Animation. */
        public List<String> title = new ArrayList<>(List.of("<gradient:gold:yellow><b>PeakVerse</b></gradient>"));
        public List<String> lines = new ArrayList<>();
        /** Leer = fuer alle; sonst nur fuer Spieler mit diesem Recht. */
        public String permission = "";

        public Page() { }

        public Page(String name, List<String> title, List<String> lines) {
            this.name = name;
            this.title = new ArrayList<>(title);
            this.lines = new ArrayList<>(lines);
        }
    }

    public boolean enabled = false;
    /** Sekunden, bis die naechste Seite kommt. */
    public int rotateSeconds = 10;
    /** Wie oft die Zeilen aktualisiert werden (Ticks, 20 = 1 Sekunde). */
    public int refreshTicks = 20;
    /** Wie schnell der Titel animiert wird (Ticks pro Bild). */
    public int titleFrameTicks = 10;
    /** Teams und Anzeigen im Tab von der normalen Scoreboard-Ansicht uebernehmen, damit Namensfarben bleiben. */
    public boolean mirrorMain = true;
    public List<Page> pages = new ArrayList<>();

    public DisplayModel copy() {
        return GSON.fromJson(GSON.toJson(this), DisplayModel.class);
    }

    public static DisplayModel fromJson(String json) {
        DisplayModel m = GSON.fromJson(json, DisplayModel.class);
        return m == null ? new DisplayModel() : m;
    }

    public String toJson() {
        return GSON.toJson(this);
    }

    /** Bringt Werte in die erlaubten Grenzen und entfernt Null-Eintraege. @return Fehlermeldung bei Dingen, die sich nicht retten lassen, sonst {@code null} */
    public String normalize() {
        if (pages == null) pages = new ArrayList<>();
        if (pages.size() > MAX_PAGES) return "Hoechstens " + MAX_PAGES + " Seiten.";
        rotateSeconds = Math.max(3, Math.min(300, rotateSeconds));
        refreshTicks = Math.max(5, Math.min(200, refreshTicks));
        titleFrameTicks = Math.max(5, Math.min(100, titleFrameTicks));
        int n = 1;
        for (Page p : pages) {
            if (p == null) return "Leere Seite.";
            if (p.name == null || p.name.isBlank()) p.name = "Seite " + n;
            p.name = clip(p.name.strip(), 30);
            if (p.permission == null) p.permission = "";
            p.permission = p.permission.strip();
            if (!p.permission.isEmpty() && !p.permission.matches("[A-Za-z0-9_.\\-]{1,64}")) return "Ungueltiges Recht auf Seite '" + p.name + "'.";
            if (p.title == null || p.title.isEmpty()) p.title = new ArrayList<>(List.of(""));
            if (p.title.size() > MAX_TITLE_FRAMES) return "Der Titel von '" + p.name + "' hat zu viele Bilder (hoechstens " + MAX_TITLE_FRAMES + ").";
            List<String> t = new ArrayList<>();
            for (String s : p.title) t.add(clip(s == null ? "" : s, MAX_TITLE));
            p.title = t;
            if (p.lines == null) p.lines = new ArrayList<>();
            if (p.lines.size() > MAX_LINES) return "Seite '" + p.name + "' hat zu viele Zeilen (hoechstens " + MAX_LINES + ").";
            List<String> l = new ArrayList<>();
            for (String s : p.lines) l.add(clip(s == null ? "" : s, MAX_TEXT));
            p.lines = l;
            n++;
        }
        return null;
    }

    private static String clip(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    /** Die Seite, die zur Zeit {@code nowMillis} dran ist, aus den Seiten, die {@code allowed} erlaubt. @return {@code -1}, wenn keine passt */
    public int pageIndexAt(long nowMillis, java.util.function.Predicate<Page> allowed) {
        List<Integer> ok = new ArrayList<>();
        for (int i = 0; i < pages.size(); i++) if (allowed.test(pages.get(i))) ok.add(i);
        if (ok.isEmpty()) return -1;
        long slot = Math.floorDiv(nowMillis, rotateSeconds * 1000L);
        return ok.get((int) Math.floorMod(slot, (long) ok.size()));
    }

    /** Das Titelbild zur Zeit {@code nowMillis}. */
    public int titleFrameAt(Page p, long nowMillis) {
        if (p.title.size() <= 1) return 0;
        long slot = Math.floorDiv(nowMillis, titleFrameTicks * 50L);
        return (int) Math.floorMod(slot, (long) p.title.size());
    }
}
