package de.peakverse.peakboard;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import de.peakverse.core.api.web.WebRegistry;
import de.peakverse.core.api.web.WebRequest;
import de.peakverse.core.api.web.WebResponse;
import de.peakverse.peakboard.BoardModel.Op;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.bukkit.Bukkit;

/**
 * Web-Schnittstelle von PeakBoard ({@code /api/peakboard/...}): Scoreboard ansehen (live und mit dem Entwurf), Aenderungen sammeln, veroeffentlichen.
 * Alles, was das echte Scoreboard beruehrt, laeuft auf dem Haupt-Thread; Fremdes (nicht von PeakBoard angelegt) braucht eine Bestaetigung.
 */
final class BoardWeb {
    private static final Gson GSON = new Gson();
    static final List<String> CRITERIA = List.of("dummy", "trigger", "deathCount", "playerKillCount", "totalKillCount", "health", "xp", "level", "food", "air", "armor",
            "minecraft.custom:minecraft.play_time", "minecraft.custom:minecraft.jump", "minecraft.custom:minecraft.walk_one_cm", "minecraft.custom:minecraft.deaths",
            "minecraft.custom:minecraft.mob_kills", "minecraft.custom:minecraft.player_kills", "minecraft.custom:minecraft.damage_dealt", "minecraft.custom:minecraft.fish_caught");

    private final WebRegistry web;
    private final BoardStore store;
    private final BoardLive live;

    BoardWeb(WebRegistry web, BoardStore store, BoardLive live) {
        this.web = web;
        this.store = store;
        this.live = live;
    }

    void register(String script) {
        web.panel("PeakBoard", "PeakBoard", script);
        web.route("state", r -> web.onMain(() -> WebResponse.json(state())));
        web.route("draft", this::draft);
        web.route("draft/*", this::draftItem);
        web.route("publish", this::publish);
    }

    // ---- Lesen ----

    private String state() {
        BoardModel now = live.read();
        List<Op> draft = store.draft();
        BoardModel sim = now.copy();
        String error = sim.applyAll(draft);
        JsonObject o = new JsonObject();
        o.add("live", modelJson(now));
        o.add("draft", modelJson(error == null ? sim : now));
        o.addProperty("draftError", error == null ? "" : error);
        JsonArray ops = new JsonArray();
        for (Op op : draft) {
            JsonObject j = new JsonObject();
            j.addProperty("text", BoardModel.describe(op));
            j.addProperty("foreign", now.touchesForeign(op));
            ops.add(j);
        }
        o.add("ops", ops);
        JsonObject lists = new JsonObject();
        lists.add("slots", strings(BoardModel.SLOTS));
        lists.add("colors", strings(BoardModel.COLORS));
        lists.add("criteria", strings(CRITERIA));
        lists.add("render", strings(BoardModel.RENDER));
        lists.add("visibility", strings(BoardModel.VISIBILITY));
        lists.add("collision", strings(BoardModel.COLLISION));
        o.add("lists", lists);
        JsonArray online = new JsonArray();
        Bukkit.getOnlinePlayers().forEach(p -> online.add(p.getName()));
        o.add("online", online);
        return GSON.toJson(o);
    }

    private static JsonArray strings(List<String> l) {
        JsonArray a = new JsonArray();
        l.forEach(a::add);
        return a;
    }

    private static JsonObject modelJson(BoardModel m) {
        JsonObject o = new JsonObject();
        JsonArray objs = new JsonArray();
        for (BoardModel.Objective x : m.objectives.values()) {
            JsonObject j = new JsonObject();
            j.addProperty("name", x.name);
            j.addProperty("criteria", x.criteria);
            j.addProperty("display", x.display);
            j.addProperty("render", x.render);
            j.addProperty("owned", x.owned);
            JsonObject scores = new JsonObject();
            x.scores.forEach(scores::addProperty);
            j.add("scores", scores);
            objs.add(j);
        }
        o.add("objectives", objs);
        JsonArray teams = new JsonArray();
        for (BoardModel.Team t : m.teams.values()) {
            JsonObject j = new JsonObject();
            j.addProperty("name", t.name);
            j.addProperty("display", t.display);
            j.addProperty("color", t.color);
            j.addProperty("prefix", t.prefix);
            j.addProperty("suffix", t.suffix);
            j.addProperty("friendlyFire", t.friendlyFire);
            j.addProperty("seeInvisible", t.seeInvisible);
            j.addProperty("nametag", t.nametag);
            j.addProperty("collision", t.collision);
            j.addProperty("owned", t.owned);
            j.add("members", strings(new ArrayList<>(t.members)));
            teams.add(j);
        }
        o.add("teams", teams);
        JsonObject slots = new JsonObject();
        m.slots.forEach(slots::addProperty);
        o.add("slots", slots);
        return o;
    }

    // ---- Entwurf ----

    private WebResponse draft(WebRequest r) throws Exception {
        if (r.method().equals("DELETE")) {
            store.clear();
            return log(r, "Entwurf verworfen");
        }
        if (!r.method().equals("POST")) return WebResponse.error(405, "POST oder DELETE");
        JsonObject body = GSON.fromJson(r.text(), JsonObject.class);
        List<Op> ops = new ArrayList<>();
        if (body == null || !body.has("ops") || !body.get("ops").isJsonArray()) throw new IllegalArgumentException("Feld fehlt: ops");
        for (JsonElement e : body.getAsJsonArray("ops")) {
            JsonObject j = e.getAsJsonObject();
            Op op = new Op();
            op.type = j.get("type").getAsString();
            if (j.has("args")) for (Map.Entry<String, JsonElement> a : j.getAsJsonObject("args").entrySet()) op.args.put(a.getKey(), a.getValue().getAsString());
            ops.add(op);
        }
        boolean confirm = body.has("confirmForeign") && body.get("confirmForeign").getAsBoolean();
        String error = web.onMain(() -> {
            BoardModel now = live.read();
            if (!confirm) {
                BoardModel sim = now.copy();
                for (Op op : store.draft()) sim.apply(op);
                for (Op op : ops) {
                    if (sim.touchesForeign(op)) return "FREMD: " + BoardModel.describe(op);
                    sim.apply(op);
                }
            }
            return store.add(now, ops);
        });
        if (error != null && error.startsWith("FREMD: ")) {
            JsonObject o = new JsonObject();
            o.addProperty("error", "Das gehoert nicht zu PeakBoard (schon vorher da, z. B. von einem anderen Plugin): " + error.substring(7) + ". Bitte bestaetigen.");
            o.addProperty("foreign", true);
            return new WebResponse(409, "application/json; charset=utf-8", GSON.toJson(o).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        if (error != null) throw new IllegalArgumentException(error);
        return log(r, ops.size() + " Aenderung(en) in den Entwurf: " + BoardModel.describe(ops.get(0)) + (ops.size() > 1 ? " ..." : ""));
    }

    private WebResponse draftItem(WebRequest r) throws Exception {
        if (!r.method().equals("DELETE")) return WebResponse.error(405, "DELETE");
        int index = Integer.parseInt(r.path().substring("draft/".length()));
        String error = web.onMain(() -> store.remove(live.read(), index));
        if (error != null) throw new IllegalArgumentException(error);
        return log(r, "Aenderung " + (index + 1) + " aus dem Entwurf genommen");
    }

    private WebResponse publish(WebRequest r) throws Exception {
        if (!r.method().equals("POST")) return WebResponse.error(405, "POST");
        List<Op> ops = store.draft();
        if (ops.isEmpty()) throw new IllegalArgumentException("Der Entwurf ist leer.");
        String error = web.onMain(() -> {
            String err = live.publish(ops);
            if (err == null) store.clear();
            return err;
        });
        if (error != null) throw new IllegalArgumentException(error);
        return log(r, ops.size() + " Aenderung(en) veroeffentlicht");
    }

    private WebResponse log(WebRequest r, String what) throws Exception {
        web.log(r.admin(), what);
        Bukkit.getLogger().info("[PeakBoard/Web] " + r.admin() + ": " + what);
        web.changed("board", r.admin());
        return web.onMain(() -> WebResponse.json(state()));
    }
}
