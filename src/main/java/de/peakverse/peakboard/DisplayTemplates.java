package de.peakverse.peakboard;

import java.util.List;

/** Fertige Anzeigen zum Uebernehmen mit einem Klick. Danach kann man alles im Editor aendern. */
public final class DisplayTemplates {
    /** Eine Vorlage mit Namen und Beschreibung (Deutsch/Englisch). */
    public record Template(String id, String nameDe, String nameEn, String descDe, String descEn, DisplayModel model) { }

    private static final String GOLD = "<gradient:gold:yellow><b>%s</b></gradient>";

    private DisplayTemplates() { }

    private static DisplayModel one(DisplayModel.Page... pages) {
        DisplayModel m = new DisplayModel();
        m.enabled = true;
        m.pages.addAll(List.of(pages));
        return m;
    }

    private static DisplayModel.Page page(String name, List<String> title, String... lines) {
        return new DisplayModel.Page(name, title, List.of(lines));
    }

    private static List<String> title(String text) {
        return List.of(String.format(GOLD, text));
    }

    public static List<Template> all() {
        DisplayModel survival = one(page("Stats", List.of("<gradient:#ff8800:#ffee55><b>PeakVerse</b></gradient>"),
                "&7%date%", "", "&eSpieler &f%player%", "&eSpielzeit &f%playtime%", "&eKills &f%kills%", "&eTode &f%deaths%", "", "&aOnline &f%online%&7/%max%", "&bPing &f%ping% ms"));

        DisplayModel kills = one(page("Rangliste", List.of("<gradient:red:gold><b>Top Kills</b></gradient>", "<gradient:gold:red><b>Top Kills</b></gradient>"),
                "&61. &f%top:Kills:1% &7- &e%topval:Kills:1%", "&72. &f%top:Kills:2% &7- &e%topval:Kills:2%", "&c3. &f%top:Kills:3% &7- &e%topval:Kills:3%",
                "&84. &f%top:Kills:4% &7- &e%topval:Kills:4%", "&85. &f%top:Kills:5% &7- &e%topval:Kills:5%", "", "&7Du: &a%score:Kills%"));
        kills.titleFrameTicks = 15;

        DisplayModel event = one(page("Event", List.of("<rainbow><b>EVENT</b></rainbow>", "<rainbow:!><b>EVENT</b></rainbow>"),
                "&7Es ist &f%time% Uhr", "", "&eDeine Punkte", "&a  %score:Punkte%", "", "&eBester Spieler", "&f  %top:Punkte:1% &7(%topval:Punkte:1%)", "", "&bOnline &f%online%"));

        DisplayModel info = one(page("Willkommen", title("MEIN SERVER"), "&7Willkommen, &f%player%&7!", "", "&eRegeln &7/regeln", "&eHilfe &7/hilfe", "", "&aOnline &f%online%&7/%max%", "&8TPS %tps%"));

        DisplayModel all = one(
                page("Stats", List.of("<gradient:#55ffff:#5555ff><b>Deine Stats</b></gradient>"), "&eSpielzeit &f%playtime%", "&eKills &f%kills%", "&eTode &f%deaths%", "&eGelaufen &f%walked% km"),
                page("Server", List.of("<gradient:#55ff55:#00aa00><b>Server</b></gradient>"), "&aOnline &f%online%&7/%max%", "&aTPS &f%tps%", "&aUhrzeit &f%time%", "&aDatum &f%date%"),
                page("Top", List.of("<gradient:gold:yellow><b>Top Kills</b></gradient>"), "&61. &f%top:Kills:1% &7%topval:Kills:1%", "&72. &f%top:Kills:2% &7%topval:Kills:2%", "&c3. &f%top:Kills:3% &7%topval:Kills:3%"));
        all.rotateSeconds = 8;

        return List.of(
                new Template("survival", "Survival-Stats", "Survival stats", "Spielzeit, Kills, Tode und Ping des Spielers.", "Play time, kills, deaths and ping of the player.", survival),
                new Template("kills", "Kills-Rangliste", "Kills leaderboard", "Top 5 nach dem Objective \"Kills\" mit blinkendem Titel. Das Objective \"Kills\" legst du im Reiter Übersicht an.",
                        "Top 5 by the objective \"Kills\" with a flashing title. Create the objective \"Kills\" in the overview tab.", kills),
                new Template("event", "Event / Minigame", "Event / minigame", "Eigene Punkte mit Bestenliste. Dafür ein Objective \"Punkte\" anlegen und im Spiel mit /scoreboard erhöhen.",
                        "Own points with a leaderboard. Create an objective \"Punkte\" and raise it with /scoreboard.", event),
                new Template("info", "Server-Info", "Server info", "Begrüßung, wichtige Befehle und Online-Zahl.", "Greeting, key commands and online count.", info),
                new Template("alles", "Alles in einem (3 Seiten)", "All in one (3 pages)", "Wechselt zwischen Stats, Server-Infos und Top-Kills.", "Rotates between stats, server info and top kills.", all));
    }
}
