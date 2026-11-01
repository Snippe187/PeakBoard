package de.peakverse.peakboard;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import de.peakverse.peakboard.BoardModel.Op;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.scoreboard.Criteria;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.RenderType;
import org.bukkit.scoreboard.Score;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;

/**
 * Die Verbindung zum echten Scoreboard von Minecraft (Haupt-Scoreboard): lesen und Aenderungen anwenden. Nur auf dem Haupt-Thread benutzen.
 * Was PeakBoard selbst angelegt hat, merkt sich {@code owned.json}; alles andere gilt als fremd und wird geschuetzt.
 */
public final class BoardLive {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final PlainTextComponentSerializer PLAIN = PlainTextComponentSerializer.plainText();
    private static final int KEEP_BACKUPS = 30;

    private final Path dataFolder;
    private final Logger logger;

    public BoardLive(Path dataFolder, Logger logger) {
        this.dataFolder = dataFolder;
        this.logger = logger;
    }

    private static Scoreboard board() {
        return Bukkit.getScoreboardManager().getMainScoreboard();
    }

    private record Owned(Set<String> objectives, Set<String> teams) { }

    private Owned loadOwned() {
        Path f = dataFolder.resolve("owned.json");
        if (Files.isRegularFile(f)) {
            try (Reader r = Files.newBufferedReader(f)) {
                Owned o = GSON.fromJson(r, new TypeToken<Owned>() { }.getType());
                if (o != null && o.objectives() != null && o.teams() != null) return o;
            } catch (IOException | RuntimeException e) {
                logger.log(Level.WARNING, "owned.json konnte nicht gelesen werden", e);
            }
        }
        return new Owned(new HashSet<>(), new HashSet<>());
    }

    private void saveOwned(BoardModel model) {
        Owned o = new Owned(new HashSet<>(), new HashSet<>());
        model.objectives.values().stream().filter(x -> x.owned).forEach(x -> o.objectives().add(x.name));
        model.teams.values().stream().filter(x -> x.owned).forEach(x -> o.teams().add(x.name));
        try {
            Files.createDirectories(dataFolder);
            Files.writeString(dataFolder.resolve("owned.json"), GSON.toJson(o));
        } catch (IOException e) {
            logger.log(Level.WARNING, "owned.json konnte nicht gespeichert werden", e);
        }
    }

    // ---- Lesen ----

    public BoardModel read() {
        Scoreboard sb = board();
        Owned owned = loadOwned();
        BoardModel m = new BoardModel();
        for (Objective o : sb.getObjectives()) {
            BoardModel.Objective x = new BoardModel.Objective();
            x.name = o.getName();
            x.criteria = o.getTrackedCriteria().getName();
            x.display = PLAIN.serialize(o.displayName());
            x.render = o.getRenderType() == RenderType.HEARTS ? "hearts" : "integer";
            x.owned = owned.objectives().contains(x.name);
            for (String e : sb.getEntries()) {
                Score s = o.getScore(e);
                if (s.isScoreSet() && x.scores.size() < BoardModel.MAX_ENTRIES_PER_OBJECTIVE) x.scores.put(e, s.getScore());
            }
            m.objectives.put(x.name, x);
        }
        for (Team t : sb.getTeams()) {
            BoardModel.Team x = new BoardModel.Team();
            x.name = t.getName();
            x.display = PLAIN.serialize(t.displayName());
            x.color = t.hasColor() && t.color() instanceof NamedTextColor c ? NamedTextColor.NAMES.key(c) : "";
            x.prefix = PLAIN.serialize(t.prefix());
            x.suffix = PLAIN.serialize(t.suffix());
            x.friendlyFire = t.allowFriendlyFire();
            x.seeInvisible = t.canSeeFriendlyInvisibles();
            x.nametag = visibility(t.getOption(Team.Option.NAME_TAG_VISIBILITY));
            x.collision = collision(t.getOption(Team.Option.COLLISION_RULE));
            x.owned = owned.teams().contains(x.name);
            x.members.addAll(t.getEntries());
            m.teams.put(x.name, x);
        }
        for (String slot : BoardModel.SLOTS) {
            Objective o = sb.getObjective(slotOf(slot));
            if (o != null) m.slots.put(slot, o.getName());
        }
        return m;
    }

    private static DisplaySlot slotOf(String slot) {
        return switch (slot) {
            case "list" -> DisplaySlot.PLAYER_LIST;
            case "below_name" -> DisplaySlot.BELOW_NAME;
            default -> DisplaySlot.SIDEBAR;
        };
    }

    private static String visibility(Team.OptionStatus s) {
        return switch (s) {
            case NEVER -> "never";
            case FOR_OTHER_TEAMS -> "hide_for_other_teams";
            case FOR_OWN_TEAM -> "hide_for_own_team";
            default -> "always";
        };
    }

    private static Team.OptionStatus visibility(String s) {
        return switch (s) {
            case "never" -> Team.OptionStatus.NEVER;
            case "hide_for_other_teams" -> Team.OptionStatus.FOR_OTHER_TEAMS;
            case "hide_for_own_team" -> Team.OptionStatus.FOR_OWN_TEAM;
            default -> Team.OptionStatus.ALWAYS;
        };
    }

    private static String collision(Team.OptionStatus s) {
        return switch (s) {
            case NEVER -> "never";
            case FOR_OTHER_TEAMS -> "push_other_teams";
            case FOR_OWN_TEAM -> "push_own_team";
            default -> "always";
        };
    }

    private static Team.OptionStatus collisionStatus(String s) {
        return switch (s) {
            case "never" -> Team.OptionStatus.NEVER;
            case "push_other_teams" -> Team.OptionStatus.FOR_OTHER_TEAMS;
            case "push_own_team" -> Team.OptionStatus.FOR_OWN_TEAM;
            default -> Team.OptionStatus.ALWAYS;
        };
    }

    // ---- Veroeffentlichen ----

    /**
     * Wendet den Entwurf auf das echte Scoreboard an. Vorher wird alles an einer Kopie ausprobiert (bei einem Fehler aendert sich nichts) und der
     * bisherige Stand gesichert. @return {@code null} bei Erfolg, sonst die Fehlermeldung
     */
    public String publish(List<Op> ops) {
        BoardModel live = read();
        BoardModel sim = live.copy();
        String err = sim.applyAll(ops);
        if (err != null) return err;
        backup(live);
        int done = 0;
        try {
            for (Op op : ops) {
                apply(op);
                done++;
            }
        } catch (RuntimeException e) {
            logger.log(Level.SEVERE, "Veroeffentlichen bei Aenderung " + (done + 1) + " abgebrochen", e);
            saveOwned(read());
            return "Aenderung " + (done + 1) + " ging schief (" + e.getMessage() + "). " + done + " Aenderungen sind schon angewendet, der Rest nicht. Der Stand davor liegt in backups/.";
        }
        saveOwned(sim);
        return null;
    }

    private void backup(BoardModel live) {
        try {
            Path dir = dataFolder.resolve("backups");
            Files.createDirectories(dir);
            Files.writeString(dir.resolve("board-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".json"), GSON.toJson(live));
            try (var files = Files.list(dir)) {
                List<Path> all = new ArrayList<>(files.filter(p -> p.getFileName().toString().startsWith("board-")).sorted().toList());
                for (int i = 0; i < all.size() - KEEP_BACKUPS; i++) Files.deleteIfExists(all.get(i));
            }
        } catch (IOException e) {
            logger.log(Level.WARNING, "Sicherung des Scoreboards fehlgeschlagen", e);
        }
    }

    private void apply(Op op) {
        Scoreboard sb = board();
        switch (op.type) {
            case "objective.create" -> sb.registerNewObjective(op.args.get("name"), Criteria.create(op.args.getOrDefault("criteria", "dummy").isEmpty() ? "dummy" : op.args.get("criteria")),
                    Component.text(op.args.getOrDefault("display", "").isEmpty() ? op.args.get("name") : op.args.get("display")), "hearts".equals(op.args.get("render")) ? RenderType.HEARTS : RenderType.INTEGER);
            case "objective.delete" -> sb.getObjective(op.args.get("name")).unregister();
            case "objective.display" -> sb.getObjective(op.args.get("name")).displayName(Component.text(op.args.get("display")));
            case "objective.render" -> sb.getObjective(op.args.get("name")).setRenderType("hearts".equals(op.args.get("render")) ? RenderType.HEARTS : RenderType.INTEGER);
            case "slot.set" -> {
                String obj = op.args.getOrDefault("objective", "");
                if (obj.isEmpty()) sb.clearSlot(slotOf(op.args.get("slot")));
                else sb.getObjective(obj).setDisplaySlot(slotOf(op.args.get("slot")));
            }
            case "score.set" -> sb.getObjective(op.args.get("objective")).getScore(op.args.get("entry")).setScore(Integer.parseInt(op.args.get("value")));
            case "score.add" -> {
                Score s = sb.getObjective(op.args.get("objective")).getScore(op.args.get("entry"));
                s.setScore((s.isScoreSet() ? s.getScore() : 0) + Integer.parseInt(op.args.get("value")));
            }
            case "score.reset" -> sb.getObjective(op.args.get("objective")).getScore(op.args.get("entry")).resetScore();
            case "team.create" -> {
                Team t = sb.registerNewTeam(op.args.get("name"));
                String d = op.args.getOrDefault("display", "");
                if (!d.isEmpty()) t.displayName(Component.text(d));
                String c = op.args.getOrDefault("color", "");
                if (!c.isEmpty()) t.color(NamedTextColor.NAMES.value(c));
            }
            case "team.delete" -> sb.getTeam(op.args.get("name")).unregister();
            case "team.set" -> {
                Team t = sb.getTeam(op.args.get("name"));
                String v = op.args.getOrDefault("value", "");
                switch (op.args.get("key")) {
                    case "display" -> t.displayName(Component.text(v));
                    case "color" -> t.color(v.isEmpty() ? null : NamedTextColor.NAMES.value(v));
                    case "prefix" -> t.prefix(Component.text(v));
                    case "suffix" -> t.suffix(Component.text(v));
                    case "friendlyFire" -> t.setAllowFriendlyFire(Boolean.parseBoolean(v));
                    case "seeInvisible" -> t.setCanSeeFriendlyInvisibles(Boolean.parseBoolean(v));
                    case "nametag" -> t.setOption(Team.Option.NAME_TAG_VISIBILITY, visibility(v));
                    case "collision" -> t.setOption(Team.Option.COLLISION_RULE, collisionStatus(v));
                    default -> throw new IllegalArgumentException("Unbekannte Team-Einstellung");
                }
            }
            case "team.add" -> sb.getTeam(op.args.get("name")).addEntry(op.args.get("entry"));
            case "team.remove" -> sb.getTeam(op.args.get("name")).removeEntry(op.args.get("entry"));
            default -> throw new IllegalArgumentException("Unbekannte Aenderung " + op.type);
        }
    }
}
