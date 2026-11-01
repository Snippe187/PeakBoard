package de.peakverse.peakboard;

import java.util.List;

/**
 * Platzhalter in Anzeige-Texten: {@code %kills%}, {@code %score:Kills%}, {@code %top:Kills:1%} ... Bukkit-frei; die Werte liefert ein {@link Values}.
 * Unbekannte Platzhalter bleiben unveraendert stehen, damit man den Tippfehler sieht.
 */
public final class Placeholders {
    /** Liefert den Wert zu einem Platzhalter-Namen (ohne die Prozentzeichen) oder {@code null}, wenn er ihn nicht kennt. */
    public interface Values {
        String get(String key);
    }

    /** Ein dokumentierter Platzhalter fuer die Auswahl im Web. */
    public record Entry(String key, String de, String en, String sample) { }

    public static final List<Entry> CATALOG = List.of(
            new Entry("player", "Name des Spielers", "Player name", "Steve"),
            new Entry("kills", "Spieler getötet", "Players killed", "12"),
            new Entry("mobkills", "Mobs getötet", "Mobs killed", "340"),
            new Entry("deaths", "Tode", "Deaths", "3"),
            new Entry("playtime", "Spielzeit (Std:Min)", "Play time (h:min)", "14:32"),
            new Entry("walked", "Gelaufene Kilometer", "Kilometres walked", "58.4"),
            new Entry("jumps", "Sprünge", "Jumps", "1204"),
            new Entry("health", "Leben", "Health", "20"),
            new Entry("food", "Hunger", "Food", "18"),
            new Entry("level", "XP-Level", "XP level", "27"),
            new Entry("ping", "Ping in ms", "Ping in ms", "34"),
            new Entry("online", "Spieler online", "Players online", "5"),
            new Entry("max", "Maximale Spielerzahl", "Max players", "20"),
            new Entry("world", "Welt", "World", "world"),
            new Entry("x", "Position X", "Position X", "128"),
            new Entry("y", "Position Y", "Position Y", "64"),
            new Entry("z", "Position Z", "Position Z", "-300"),
            new Entry("team", "Team des Spielers", "Player's team", "Rot"),
            new Entry("time", "Uhrzeit des Servers", "Server time", "21:07"),
            new Entry("date", "Datum", "Date", "01.11.2026"),
            new Entry("tps", "Server-TPS", "Server TPS", "20.0"),
            new Entry("money", "Geld (braucht Vault)", "Money (needs Vault)", "1.250"),
            new Entry("score:NAME", "Punkte des Spielers im Objective NAME", "Player's score in objective NAME", "7"),
            new Entry("top:NAME:1", "Name auf Platz 1 des Objectives NAME", "Name at rank 1 of objective NAME", "Alex"),
            new Entry("topval:NAME:1", "Punkte auf Platz 1 des Objectives NAME", "Score at rank 1 of objective NAME", "42"),
            new Entry("papi:NAME", "Platzhalter von PlaceholderAPI", "PlaceholderAPI placeholder", "..."));

    private Placeholders() { }

    /** Ersetzt jedes {@code %name%}, das {@code values} kennt. */
    public static String resolve(String text, Values values) {
        if (text == null || text.indexOf('%') < 0) return text == null ? "" : text;
        StringBuilder out = new StringBuilder(text.length() + 16);
        int i = 0, n = text.length();
        while (i < n) {
            char c = text.charAt(i);
            if (c == '%') {
                int end = i + 1;
                while (end < n && end - i <= 64 && isKeyChar(text.charAt(end))) end++;
                if (end < n && text.charAt(end) == '%' && end > i + 1) {
                    String key = text.substring(i + 1, end);
                    String v = values.get(key);
                    if (v != null) {
                        out.append(v);
                        i = end + 1;
                        continue;
                    }
                }
            }
            out.append(c);
            i++;
        }
        return out.toString();
    }

    private static boolean isKeyChar(char c) {
        return Character.isLetterOrDigit(c) || c == '_' || c == ':' || c == '.' || c == '-' || c == '#';
    }

    /** Beispielwerte fuer die Vorschau ohne echten Spieler. */
    public static Values samples() {
        return key -> {
            for (Entry e : CATALOG) if (e.key().equals(key)) return e.sample();
            String[] p = key.split(":");
            return switch (p[0]) {
                case "score" -> "7";
                case "top" -> p.length > 2 ? new String[] {"Alex", "Steve", "Kim", "Joe", "Mia", "Lea", "Tom", "Ben", "Zoe", "Max"}[(parseInt(p[2], 1) - 1 + 10) % 10] : null;
                case "topval" -> p.length > 2 ? String.valueOf(Math.max(1, 46 - 4 * parseInt(p[2], 1))) : null;
                case "papi" -> "...";
                default -> null;
            };
        };
    }

    static int parseInt(String s, int fallback) {
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
