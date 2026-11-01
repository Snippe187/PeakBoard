package de.peakverse.peakboard;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import de.peakverse.core.api.web.WebRegistry;
import de.peakverse.core.api.web.WebRequest;
import de.peakverse.core.api.web.WebResponse;
import java.util.List;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

/**
 * Web-Schnittstelle der Spieler-Anzeige ({@code /api/peakboard/display...}): lesen, speichern, vorschauen. Gespeichert wird sofort (kein Entwurf), die
 * Vorschau rechnet aber mit denselben Regeln wie die echte Anzeige.
 */
final class DisplayWeb {
    private static final Gson GSON = new Gson();

    private final WebRegistry web;
    private final DisplayStore store;
    private final DisplayLive live;

    DisplayWeb(WebRegistry web, DisplayStore store, DisplayLive live) {
        this.web = web;
        this.store = store;
        this.live = live;
    }

    void register() {
        web.route("display", this::display);
        web.route("display/preview", this::preview);
    }

    private WebResponse display(WebRequest r) throws Exception {
        if (r.method().equals("POST")) {
            DisplayModel next;
            try {
                next = DisplayModel.fromJson(r.text());
            } catch (RuntimeException e) {
                throw new IllegalArgumentException("Die Anzeige ist kein gueltiges JSON.");
            }
            String error = store.save(next);
            if (error != null) throw new IllegalArgumentException(error);
            web.onMain(() -> {
                live.apply();
                return null;
            });
            String what = next.enabled ? "Anzeige gespeichert (" + next.pages.size() + " Seite(n))" : "Anzeige gespeichert und ausgeschaltet";
            web.log(r.admin(), what);
            Bukkit.getLogger().info("[PeakBoard/Web] " + r.admin() + ": " + what);
            web.changed("display", r.admin());
        } else if (!r.method().equals("GET")) {
            return WebResponse.error(405, "GET oder POST");
        }
        return WebResponse.json(state());
    }

    private String state() throws Exception {
        JsonObject o = new JsonObject();
        o.add("display", GSON.toJsonTree(store.model()));
        JsonArray templates = new JsonArray();
        for (DisplayTemplates.Template t : DisplayTemplates.all()) templates.add(GSON.toJsonTree(t));
        o.add("templates", templates);
        JsonArray catalog = new JsonArray();
        for (Placeholders.Entry e : Placeholders.CATALOG) catalog.add(GSON.toJsonTree(e));
        o.add("catalog", catalog);
        JsonObject limits = new JsonObject();
        limits.addProperty("pages", DisplayModel.MAX_PAGES);
        limits.addProperty("lines", DisplayModel.MAX_LINES);
        limits.addProperty("text", DisplayModel.MAX_TEXT);
        limits.addProperty("frames", DisplayModel.MAX_TITLE_FRAMES);
        o.add("limits", limits);
        o.add("online", web.onMain(() -> {
            JsonArray a = new JsonArray();
            Bukkit.getOnlinePlayers().forEach(p -> a.add(p.getName()));
            JsonObject wrap = new JsonObject();
            wrap.add("list", a);
            return wrap;
        }).get("list"));
        o.add("objectives", web.onMain(() -> {
            JsonArray a = new JsonArray();
            Bukkit.getScoreboardManager().getMainScoreboard().getObjectives().forEach(x -> a.add(x.getName()));
            JsonObject wrap = new JsonObject();
            wrap.add("list", a);
            return wrap;
        }).get("list"));
        return GSON.toJson(o);
    }

    /** Rechnet eine Seite mit den Platzhaltern aus (mit den Werten eines Spielers oder mit Beispielen) und liefert die Abschnitte fuer die Vorschau. */
    private WebResponse preview(WebRequest r) throws Exception {
        if (!r.method().equals("POST")) return WebResponse.error(405, "POST");
        JsonObject body = GSON.fromJson(r.text(), JsonObject.class);
        if (body == null || !body.has("page")) throw new IllegalArgumentException("Feld fehlt: page");
        DisplayModel.Page page = GSON.fromJson(body.get("page"), DisplayModel.Page.class);
        DisplayModel probe = new DisplayModel();
        probe.pages.add(page);
        String error = probe.normalize();
        if (error != null) throw new IllegalArgumentException(error);
        String player = body.has("player") && !body.get("player").isJsonNull() ? body.get("player").getAsString() : "";
        Placeholders.Values values = player.isEmpty() ? Placeholders.samples() : web.onMain(() -> {
            Player p = Bukkit.getPlayerExact(player);
            return p == null ? Placeholders.samples() : live.valuesFor(p);
        });
        // Platzhalter koennen Bukkit brauchen: die Ersetzung selbst laeuft deshalb auf dem Haupt-Thread
        JsonObject out = web.onMain(() -> {
            JsonObject o = new JsonObject();
            JsonArray frames = new JsonArray();
            for (String t : page.title) frames.add(spans(Placeholders.resolve(t, values)));
            o.add("title", frames);
            JsonArray lines = new JsonArray();
            for (String l : page.lines) lines.add(spans(Placeholders.resolve(l, values)));
            o.add("lines", lines);
            return o;
        });
        return WebResponse.json(GSON.toJson(out));
    }

    private static JsonArray spans(String text) {
        JsonArray a = new JsonArray();
        List<Fmt.Span> list = Fmt.parse(text);
        for (Fmt.Span s : list) {
            JsonObject j = new JsonObject();
            j.addProperty("t", s.text());
            j.addProperty("c", s.color() < 0 ? "" : String.format("#%06x", s.color()));
            j.addProperty("f", s.flags());
            a.add(j);
        }
        return a;
    }
}
