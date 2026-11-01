package de.peakverse.peakboard;

import de.peakverse.core.api.module.ModuleContext;
import de.peakverse.core.api.module.PeakModule;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.entity.Player;

/**
 * PeakBoard: Scoreboard (Objectives, Punktestaende, Anzeige-Plaetze, Teams) in der PeakVerse-Weboberflaeche verwalten.
 * Aenderungen werden als Entwurf gesammelt und mit einem Klick veroeffentlicht; was PeakBoard nicht selbst angelegt hat, ist geschuetzt.
 */
public final class PeakBoardModule implements PeakModule {
    private ModuleContext context;
    private DisplayStore displayStore;
    private DisplayLive display;

    @Override
    public String id() {
        return "peakboard";
    }

    @Override
    public String displayName() {
        return "PeakBoard";
    }

    @Override
    public void enable(ModuleContext context) {
        this.context = context;
        context.saveDefaultConfig();
        BoardStore store = new BoardStore(context.dataFolder().toPath(), context.logger());
        store.load();
        BoardLive live = new BoardLive(context.dataFolder().toPath(), context.logger());
        if (context.web().enabled()) {
            try (InputStream in = PeakBoardModule.class.getResourceAsStream("/modules/peakboard/panel.js")) {
                if (in == null) throw new IOException("panel.js fehlt im Jar");
                new BoardWeb(context.web(), store, live).register(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            } catch (IOException e) {
                context.logger().warning("Web-Seite von PeakBoard nicht verfuegbar: " + e.getMessage());
            }
        } else {
            context.logger().info("Die Web-Oberflaeche ist aus (web.enabled in der PeakCore-config.yml): PeakBoard hat dann keine Seite.");
        }
        displayStore = new DisplayStore(context.dataFolder().toPath(), context.logger());
        displayStore.load();
        display = new DisplayLive(context.host(), displayStore, context.logger());
        display.apply();
        if (context.web().enabled()) new DisplayWeb(context.web(), displayStore, display).register();
        PluginCommand cmd = context.host().getCommand("board");
        if (cmd != null) cmd.setExecutor((sender, command, label, args) -> toggle(sender));
        context.logger().info("PeakBoard bereit, Entwurf: " + store.draft().size() + " Aenderung(en), Spieler-Anzeige: "
                + (displayStore.model().enabled ? displayStore.model().pages.size() + " Seite(n)" : "aus") + ".");
    }

    private boolean toggle(CommandSender sender) {
        if (!(sender instanceof Player p)) {
            sender.sendMessage("Nur fuer Spieler.");
            return true;
        }
        if (!p.hasPermission("peakboard.toggle")) {
            p.sendMessage(Component.text("Dafuer fehlt dir das Recht.", NamedTextColor.RED));
            return true;
        }
        boolean off = displayStore.toggleOff(p.getUniqueId());
        p.sendMessage(Component.text(off ? "Die Anzeige rechts ist fuer dich aus. Mit /board wieder an." : "Die Anzeige rechts ist wieder an.", NamedTextColor.GREEN));
        return true;
    }

    @Override
    public void disable() {
        if (display != null) display.stop();
        display = null;
        context = null;
    }
}
