package de.peakverse.peakboard;

import io.papermc.paper.scoreboard.numbers.NumberFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.scoreboard.Criteria;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;

/**
 * Zeigt jedem Spieler seine eigene Seitenleiste (eigenes Scoreboard pro Spieler) mit Seiten, die nach Zeit wechseln, einem animierten Titel und
 * Platzhaltern. Teams und die Anzeigen im Tab / unter dem Namen werden vom Haupt-Scoreboard uebernommen, damit Namensfarben und Punkte dort bleiben.
 * Nur auf dem Haupt-Thread benutzen.
 */
public final class DisplayLive implements Listener {
    private static final String SIDE = "pb_side";

    /** Das eigene Scoreboard eines Spielers und was zuletzt darauf stand. */
    private static final class Board {
        final Scoreboard sb = Bukkit.getScoreboardManager().getNewScoreboard();
        final Objective side = sb.registerNewObjective(SIDE, Criteria.DUMMY, Component.empty());
        String title = "";
        List<String> lines = new ArrayList<>();
        String teamSig = "";
        final Map<DisplaySlot, Objective> mirrored = new HashMap<>();

        Board() {
            side.setDisplaySlot(DisplaySlot.SIDEBAR);
            side.numberFormat(NumberFormat.blank());
        }
    }

    private final JavaPlugin plugin;
    private final DisplayStore store;
    private final Logger logger;
    private final PlayerValues values = new PlayerValues();
    private final Map<UUID, Board> boards = new HashMap<>();
    private DisplayModel model = new DisplayModel();
    private BukkitTask task;
    private boolean registered;

    public DisplayLive(JavaPlugin plugin, DisplayStore store, Logger logger) {
        this.plugin = plugin;
        this.store = store;
        this.logger = logger;
    }

    /** Uebernimmt die gespeicherte Anzeige und startet oder beendet die Aktualisierung. */
    public void apply() {
        model = store.model();
        if (task != null) {
            task.cancel();
            task = null;
        }
        if (!registered) {
            Bukkit.getPluginManager().registerEvents(this, plugin);
            registered = true;
        }
        if (!model.enabled || model.pages.isEmpty()) {
            restoreAll();
            return;
        }
        boolean animated = model.pages.stream().anyMatch(p -> p.title.size() > 1);
        int period = animated ? Math.min(model.refreshTicks, model.titleFrameTicks) : model.refreshTicks;
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 1L, Math.max(2, period));
    }

    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
        restoreAll();
    }

    private void restoreAll() {
        Scoreboard main = Bukkit.getScoreboardManager().getMainScoreboard();
        for (UUID id : new ArrayList<>(boards.keySet())) {
            Player p = Bukkit.getPlayer(id);
            if (p != null && boards.get(id) != null && p.getScoreboard() == boards.get(id).sb) p.setScoreboard(main);
        }
        boards.clear();
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        boards.remove(e.getPlayer().getUniqueId());
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        // sofort der erste Durchlauf, damit die Anzeige nicht erst nach dem naechsten Takt erscheint
        if (task != null) Bukkit.getScheduler().runTask(plugin, () -> update(e.getPlayer(), System.currentTimeMillis()));
    }

    private void tick() {
        long now = System.currentTimeMillis();
        values.newRound();
        for (Player p : Bukkit.getOnlinePlayers()) {
            try {
                update(p, now);
            } catch (RuntimeException ex) {
                logger.log(Level.WARNING, "Anzeige fuer " + p.getName() + " ging schief", ex);
            }
        }
        boards.keySet().removeIf(id -> Bukkit.getPlayer(id) == null);
    }

    private void update(Player p, long now) {
        if (!p.isOnline()) return;
        Scoreboard main = Bukkit.getScoreboardManager().getMainScoreboard();
        if (store.isOff(p.getUniqueId())) {
            Board old = boards.remove(p.getUniqueId());
            if (old != null && p.getScoreboard() == old.sb) p.setScoreboard(main);
            return;
        }
        int idx = model.pageIndexAt(now, page -> page.permission.isEmpty() || p.hasPermission(page.permission));
        Board b = boards.get(p.getUniqueId());
        if (idx < 0) {
            if (b != null) {
                boards.remove(p.getUniqueId());
                if (p.getScoreboard() == b.sb) p.setScoreboard(main);
            }
            return;
        }
        if (b == null) {
            b = new Board();
            boards.put(p.getUniqueId(), b);
        }
        if (p.getScoreboard() != b.sb) p.setScoreboard(b.sb);
        DisplayModel.Page page = model.pages.get(idx);
        Placeholders.Values v = values.of(p);

        String title = Placeholders.resolve(page.title.get(model.titleFrameAt(page, now)), v);
        if (!title.equals(b.title)) {
            b.title = title;
            b.side.displayName(toComponent(Fmt.parse(title)));
        }
        List<String> lines = new ArrayList<>();
        for (String raw : page.lines) lines.add(Placeholders.resolve(raw, v));
        // Die Zahl hinter einer Zeile (nur fuer die Reihenfolge) haengt von der Anzahl ab: aendert sie sich, werden alle Zeilen neu gesetzt
        boolean reorder = b.lines.size() != lines.size();
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            if (!reorder && b.lines.get(i).equals(line)) continue;
            var score = b.side.getScore("pb_l" + i);
            score.customName(toComponent(Fmt.parse(line)));
            score.setScore(lines.size() - i);
        }
        for (int i = lines.size(); i < b.lines.size(); i++) b.sb.resetScores("pb_l" + i);
        b.lines = lines;
        if (model.mirrorMain) mirror(b, main);
    }

    // ---- Teams und Anzeigen vom Haupt-Scoreboard uebernehmen ----

    private void mirror(Board b, Scoreboard main) {
        StringBuilder sig = new StringBuilder();
        for (Team t : main.getTeams()) {
            sig.append(t.getName()).append('|').append(t.hasColor() ? t.color().toString() : "").append('|').append(t.prefix()).append('|').append(t.suffix()).append('|')
                    .append(t.displayName()).append('|').append(t.allowFriendlyFire()).append(t.canSeeFriendlyInvisibles());
            for (Team.Option o : Team.Option.values()) sig.append(t.getOption(o));
            sig.append(t.getEntries()).append(';');
        }
        String signature = sig.toString();
        if (!signature.equals(b.teamSig)) {
            b.teamSig = signature;
            for (Team old : new ArrayList<>(b.sb.getTeams())) old.unregister();
            for (Team s : main.getTeams()) {
                Team d = b.sb.registerNewTeam(s.getName());
                d.displayName(s.displayName());
                d.prefix(s.prefix());
                d.suffix(s.suffix());
                if (s.hasColor() && s.color() instanceof NamedTextColor c) d.color(c);
                d.setAllowFriendlyFire(s.allowFriendlyFire());
                d.setCanSeeFriendlyInvisibles(s.canSeeFriendlyInvisibles());
                for (Team.Option o : Team.Option.values()) d.setOption(o, s.getOption(o));
                for (String e : s.getEntries()) d.addEntry(e);
            }
        }
        for (DisplaySlot slot : new DisplaySlot[] {DisplaySlot.PLAYER_LIST, DisplaySlot.BELOW_NAME}) {
            Objective src = main.getObjective(slot);
            Objective dst = b.mirrored.get(slot);
            if (src == null) {
                if (dst != null) {
                    dst.unregister();
                    b.mirrored.remove(slot);
                }
                continue;
            }
            if (dst == null || !dst.getName().equals(src.getName())) {
                if (dst != null) dst.unregister();
                Objective existing = b.sb.getObjective(src.getName());
                dst = existing != null ? existing : b.sb.registerNewObjective(src.getName(), Criteria.DUMMY, src.displayName(), src.getRenderType());
                dst.setDisplaySlot(slot);
                b.mirrored.put(slot, dst);
            }
            for (Player online : Bukkit.getOnlinePlayers()) {
                var s = src.getScore(online.getName());
                if (!s.isScoreSet()) continue;
                var d = dst.getScore(online.getName());
                if (!d.isScoreSet() || d.getScore() != s.getScore()) d.setScore(s.getScore());
            }
        }
    }

    /** Baut aus Abschnitten eine Chat-Komponente. */
    static Component toComponent(List<Fmt.Span> spans) {
        Component out = Component.empty();
        for (Fmt.Span s : spans) {
            Component c = Component.text(s.text());
            if (s.color() >= 0) c = c.color(TextColor.color(s.color()));
            c = c.decoration(TextDecoration.BOLD, (s.flags() & Fmt.B) != 0)
                    .decoration(TextDecoration.ITALIC, (s.flags() & Fmt.I) != 0)
                    .decoration(TextDecoration.UNDERLINED, (s.flags() & Fmt.U) != 0)
                    .decoration(TextDecoration.STRIKETHROUGH, (s.flags() & Fmt.S) != 0)
                    .decoration(TextDecoration.OBFUSCATED, (s.flags() & Fmt.O) != 0);
            out = out.append(c);
        }
        return out;
    }

    // ---- Vorschau fuer das Web ----

    /** Werte fuer einen Spieler (Haupt-Thread), fuer die Vorschau mit echten Zahlen. */
    public Placeholders.Values valuesFor(Player p) {
        values.newRound();
        return values.of(p);
    }
}
