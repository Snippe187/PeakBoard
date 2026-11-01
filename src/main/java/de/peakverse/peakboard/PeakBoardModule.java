package de.peakverse.peakboard;

import de.peakverse.core.api.module.ModuleContext;
import de.peakverse.core.api.module.PeakModule;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * PeakBoard: Scoreboard (Objectives, Punktestaende, Anzeige-Plaetze, Teams) in der PeakVerse-Weboberflaeche verwalten.
 * Aenderungen werden als Entwurf gesammelt und mit einem Klick veroeffentlicht; was PeakBoard nicht selbst angelegt hat, ist geschuetzt.
 */
public final class PeakBoardModule implements PeakModule {
    private ModuleContext context;

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
        context.logger().info("PeakBoard bereit, Entwurf: " + store.draft().size() + " Aenderung(en).");
    }

    @Override
    public void disable() {
        context = null;
    }
}
