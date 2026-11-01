package de.peakverse.peakboard;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.Statistic;
import org.bukkit.entity.Player;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;

/**
 * Werte fuer die Platzhalter eines Spielers. Vault und PlaceholderAPI werden nur benutzt, wenn sie auf dem Server sind (ueber Reflection, damit
 * PeakBoard sie nicht braucht). Nur auf dem Haupt-Thread benutzen. Ranglisten werden pro Durchlauf zwischengespeichert ({@link #newRound}).
 */
final class PlayerValues {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final Map<String, List<Map.Entry<String, Integer>>> tops = new ConcurrentHashMap<>();
    private Object economy;
    private Method balance, format;
    private boolean economyLooked;
    private Method papi;
    private boolean papiLooked;

    /** Vor jedem Durchlauf aufrufen: vergisst die Ranglisten des letzten. */
    void newRound() {
        tops.clear();
    }

    Placeholders.Values of(Player p) {
        return key -> value(p, key);
    }

    private String value(Player p, String key) {
        String[] parts = key.split(":");
        switch (parts[0].toLowerCase(Locale.ROOT)) {
            case "player": return p.getName();
            case "kills": return stat(p, Statistic.PLAYER_KILLS);
            case "mobkills": return stat(p, Statistic.MOB_KILLS);
            case "deaths": return stat(p, Statistic.DEATHS);
            case "jumps": return stat(p, Statistic.JUMP);
            case "playtime": {
                long minutes = p.getStatistic(Statistic.PLAY_ONE_MINUTE) / 20 / 60;
                return (minutes / 60) + ":" + String.format("%02d", minutes % 60);
            }
            case "walked": return String.format(Locale.ROOT, "%.1f", p.getStatistic(Statistic.WALK_ONE_CM) / 100000.0);
            case "health": return String.valueOf((int) Math.ceil(p.getHealth()));
            case "food": return String.valueOf(p.getFoodLevel());
            case "level": return String.valueOf(p.getLevel());
            case "ping": return String.valueOf(p.getPing());
            case "online": return String.valueOf(Bukkit.getOnlinePlayers().size());
            case "max": return String.valueOf(Bukkit.getMaxPlayers());
            case "world": return p.getWorld().getName();
            case "x": return String.valueOf(p.getLocation().getBlockX());
            case "y": return String.valueOf(p.getLocation().getBlockY());
            case "z": return String.valueOf(p.getLocation().getBlockZ());
            case "team": {
                Team t = Bukkit.getScoreboardManager().getMainScoreboard().getEntryTeam(p.getName());
                return t == null ? "-" : net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(t.displayName());
            }
            case "time": return LocalTime.now().format(TIME);
            case "date": return LocalDate.now().format(DATE);
            case "tps": return String.format(Locale.ROOT, "%.1f", Math.min(20.0, Bukkit.getTPS()[0]));
            case "money": return money(p);
            case "score": return parts.length > 1 ? score(parts[1], p.getName()) : null;
            case "top": return parts.length > 2 ? top(parts[1], Placeholders.parseInt(parts[2], 1), false) : null;
            case "topval": return parts.length > 2 ? top(parts[1], Placeholders.parseInt(parts[2], 1), true) : null;
            case "papi": return parts.length > 1 ? papi(p, key.substring(key.indexOf(':') + 1)) : null;
            default: return null;
        }
    }

    private static String stat(Player p, Statistic s) {
        return String.valueOf(p.getStatistic(s));
    }

    private static String score(String objective, String entry) {
        Objective o = Bukkit.getScoreboardManager().getMainScoreboard().getObjective(objective);
        if (o == null) return "-";
        var s = o.getScore(entry);
        return s.isScoreSet() ? String.valueOf(s.getScore()) : "0";
    }

    private String top(String objective, int rank, boolean value) {
        List<Map.Entry<String, Integer>> list = tops.computeIfAbsent(objective, name -> {
            Scoreboard sb = Bukkit.getScoreboardManager().getMainScoreboard();
            Objective o = sb.getObjective(name);
            List<Map.Entry<String, Integer>> rows = new ArrayList<>();
            if (o != null) {
                for (String e : sb.getEntries()) {
                    var s = o.getScore(e);
                    if (s.isScoreSet()) rows.add(Map.entry(e, s.getScore()));
                }
                rows.sort((a, b) -> b.getValue() != a.getValue().intValue() ? Integer.compare(b.getValue(), a.getValue()) : a.getKey().compareToIgnoreCase(b.getKey()));
            }
            return rows;
        });
        if (rank < 1 || rank > list.size()) return value ? "-" : "-";
        Map.Entry<String, Integer> e = list.get(rank - 1);
        return value ? String.valueOf(e.getValue()) : e.getKey();
    }

    private String money(OfflinePlayer p) {
        if (!economyLooked) {
            economyLooked = true;
            try {
                Class<?> eco = Class.forName("net.milkbowl.vault.economy.Economy");
                var reg = Bukkit.getServicesManager().getRegistration((Class<Object>) eco);
                if (reg != null) {
                    economy = reg.getProvider();
                    balance = eco.getMethod("getBalance", OfflinePlayer.class);
                    format = eco.getMethod("format", double.class);
                }
            } catch (ReflectiveOperationException | RuntimeException | LinkageError e) {
                economy = null;
            }
        }
        if (economy == null) return "-";
        try {
            return String.valueOf(format.invoke(economy, (double) balance.invoke(economy, p)));
        } catch (ReflectiveOperationException | RuntimeException e) {
            return "-";
        }
    }

    private String papi(Player p, String name) {
        if (!papiLooked) {
            papiLooked = true;
            try {
                papi = Class.forName("me.clip.placeholderapi.PlaceholderAPI").getMethod("setPlaceholders", OfflinePlayer.class, String.class);
            } catch (ReflectiveOperationException | LinkageError e) {
                papi = null;
            }
        }
        if (papi == null) return "-";
        try {
            String raw = "%" + name + "%";
            String out = (String) papi.invoke(null, p, raw);
            return out.equals(raw) ? "-" : out;
        } catch (ReflectiveOperationException | RuntimeException e) {
            return "-";
        }
    }
}
