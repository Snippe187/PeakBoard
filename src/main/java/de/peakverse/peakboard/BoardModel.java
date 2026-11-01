package de.peakverse.peakboard;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * Abbild des Scoreboards (Objectives, Punktestaende, Anzeige-Plaetze, Teams), ohne Bukkit. Aenderungen sind {@link Op}-Eintraege: sie werden zuerst
 * als Entwurf an einer Kopie ausprobiert und erst beim Veroeffentlichen auf das echte Scoreboard angewendet.
 */
public final class BoardModel {
    public static final List<String> SLOTS = List.of("sidebar", "list", "below_name");
    public static final List<String> COLORS = List.of("black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray",
            "blue", "green", "aqua", "red", "light_purple", "yellow", "white");
    public static final List<String> RENDER = List.of("integer", "hearts");
    public static final List<String> VISIBILITY = List.of("always", "never", "hide_for_other_teams", "hide_for_own_team");
    public static final List<String> COLLISION = List.of("always", "never", "push_other_teams", "push_own_team");
    public static final int MAX_ENTRIES_PER_OBJECTIVE = 5000;

    private static final Pattern NAME = Pattern.compile("[A-Za-z0-9_.+-]{1,40}");
    private static final Pattern CRITERIA = Pattern.compile("[A-Za-z0-9_.:-]{1,100}");

    /** Eine Aenderung am Scoreboard, z. B. {@code objective.create} mit den Angaben {@code name}, {@code criteria}, {@code display}. */
    public static final class Op {
        public String type;
        public Map<String, String> args = new LinkedHashMap<>();

        public Op() { }

        public Op(String type, String... kv) {
            this.type = type;
            for (int i = 0; i + 1 < kv.length; i += 2) args.put(kv[i], kv[i + 1]);
        }

        String a(String key) {
            String v = args.get(key);
            return v == null ? "" : v;
        }
    }

    public static final class Objective {
        public String name;
        public String criteria = "dummy";
        public String display = "";
        public String render = "integer";
        public boolean owned;
        public final Map<String, Integer> scores = new TreeMap<>();
    }

    public static final class Team {
        public String name;
        public String display = "";
        public String color = "";
        public String prefix = "";
        public String suffix = "";
        public boolean friendlyFire = true;
        public boolean seeInvisible = true;
        public String nametag = "always";
        public String collision = "always";
        public boolean owned;
        public final Set<String> members = new TreeSet<>();
    }

    public final Map<String, Objective> objectives = new TreeMap<>();
    public final Map<String, Team> teams = new TreeMap<>();
    public final Map<String, String> slots = new LinkedHashMap<>();

    public BoardModel copy() {
        BoardModel m = new BoardModel();
        for (Objective o : objectives.values()) {
            Objective n = new Objective();
            n.name = o.name;
            n.criteria = o.criteria;
            n.display = o.display;
            n.render = o.render;
            n.owned = o.owned;
            n.scores.putAll(o.scores);
            m.objectives.put(n.name, n);
        }
        for (Team t : teams.values()) {
            Team n = new Team();
            n.name = t.name;
            n.display = t.display;
            n.color = t.color;
            n.prefix = t.prefix;
            n.suffix = t.suffix;
            n.friendlyFire = t.friendlyFire;
            n.seeInvisible = t.seeInvisible;
            n.nametag = t.nametag;
            n.collision = t.collision;
            n.owned = t.owned;
            n.members.addAll(t.members);
            m.teams.put(n.name, n);
        }
        m.slots.putAll(slots);
        return m;
    }

    /** Gehoert das, was die Aenderung beruehrt, nicht PeakBoard (schon vorher da, z. B. von einem anderen Plugin)? Dann muss man es bestaetigen. */
    public boolean touchesForeign(Op op) {
        String t = op.type == null ? "" : op.type;
        if (t.startsWith("objective.") && !t.equals("objective.create")) {
            Objective o = objectives.get(op.a("name"));
            return o != null && !o.owned;
        }
        if (t.startsWith("score.")) {
            Objective o = objectives.get(op.a("objective"));
            return o != null && !o.owned;
        }
        if (t.equals("slot.set")) {
            Objective o = objectives.get(op.a("objective"));
            Objective old = objectives.get(slots.getOrDefault(op.a("slot"), ""));
            return (o != null && !o.owned) || (old != null && !old.owned);
        }
        if (t.startsWith("team.") && !t.equals("team.create")) {
            Team tm = teams.get(op.a("name"));
            return tm != null && !tm.owned;
        }
        return false;
    }

    /** Wendet eine Aenderung an. @return {@code null} bei Erfolg, sonst die Fehlermeldung (das Modell bleibt dann unveraendert) */
    public String apply(Op op) {
        if (op == null || op.type == null) return "Keine Aenderung angegeben.";
        try {
            return switch (op.type) {
                case "objective.create" -> createObjective(op);
                case "objective.delete" -> deleteObjective(op);
                case "objective.display" -> {
                    Objective o = objective(op.a("name"));
                    String d = text(op.a("display"), 64);
                    o.display = d;
                    yield null;
                }
                case "objective.render" -> {
                    Objective o = objective(op.a("name"));
                    if (!RENDER.contains(op.a("render"))) yield "Unbekannte Darstellung: " + op.a("render");
                    o.render = op.a("render");
                    yield null;
                }
                case "slot.set" -> setSlot(op);
                case "score.set" -> score(op, 0);
                case "score.add" -> score(op, 1);
                case "score.reset" -> score(op, 2);
                case "team.create" -> createTeam(op);
                case "team.delete" -> {
                    team(op.a("name"));
                    teams.remove(op.a("name"));
                    yield null;
                }
                case "team.set" -> setTeam(op);
                case "team.add" -> {
                    Team t = team(op.a("name"));
                    String e = entry(op.a("entry"));
                    for (Team other : teams.values()) if (other != t && other.members.contains(e)) yield "\"" + e + "\" ist schon im Team " + other.name + ".";
                    t.members.add(e);
                    yield null;
                }
                case "team.remove" -> {
                    team(op.a("name")).members.remove(entry(op.a("entry")));
                    yield null;
                }
                default -> "Unbekannte Aenderung: " + op.type;
            };
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        }
    }

    /** Alle Aenderungen der Reihe nach; bei einem Fehler Abbruch mit der Nummer (ab 1). */
    public String applyAll(List<Op> ops) {
        for (int i = 0; i < ops.size(); i++) {
            String err = apply(ops.get(i));
            if (err != null) return "Aenderung " + (i + 1) + ": " + err;
        }
        return null;
    }

    private static String name(String v) {
        if (!NAME.matcher(v).matches()) throw new IllegalArgumentException("Ungueltiger Name \"" + v + "\" (erlaubt: Buchstaben, Ziffern, _ . + -, hoechstens 40 Zeichen).");
        return v;
    }

    private static String entry(String v) {
        if (v.isEmpty() || v.length() > 40 || v.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("Ungueltiger Eintrag \"" + v + "\" (1 bis 40 Zeichen).");
        return v;
    }

    private static String text(String v, int max) {
        if (v.length() > max || v.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("Der Text ist zu lang oder enthaelt Steuerzeichen (hoechstens " + max + " Zeichen).");
        return v;
    }

    private Objective objective(String n) {
        Objective o = objectives.get(n);
        if (o == null) throw new IllegalArgumentException("Das Objective \"" + n + "\" gibt es nicht.");
        return o;
    }

    private Team team(String n) {
        Team t = teams.get(n);
        if (t == null) throw new IllegalArgumentException("Das Team \"" + n + "\" gibt es nicht.");
        return t;
    }

    private String createObjective(Op op) {
        String n = name(op.a("name"));
        if (objectives.containsKey(n)) return "Das Objective \"" + n + "\" gibt es schon.";
        String crit = op.a("criteria").isEmpty() ? "dummy" : op.a("criteria");
        if (!CRITERIA.matcher(crit).matches()) return "Ungueltiges Kriterium: " + crit;
        Objective o = new Objective();
        o.name = n;
        o.criteria = crit;
        o.display = text(op.a("display"), 64);
        o.owned = true;
        if (!op.a("render").isEmpty()) {
            if (!RENDER.contains(op.a("render"))) return "Unbekannte Darstellung: " + op.a("render");
            o.render = op.a("render");
        }
        objectives.put(n, o);
        return null;
    }

    private String deleteObjective(Op op) {
        Objective o = objective(op.a("name"));
        objectives.remove(o.name);
        slots.values().removeIf(v -> v.equals(o.name));
        return null;
    }

    private String setSlot(Op op) {
        String slot = op.a("slot");
        if (!SLOTS.contains(slot)) return "Unbekannter Anzeige-Platz: " + slot;
        String obj = op.a("objective");
        if (obj.isEmpty()) {
            slots.remove(slot);
            return null;
        }
        objective(obj);
        slots.put(slot, obj);
        return null;
    }

    /** {@code mode}: 0 = setzen, 1 = addieren, 2 = zuruecksetzen. */
    private String score(Op op, int mode) {
        Objective o = objective(op.a("objective"));
        String e = entry(op.a("entry"));
        if (mode == 2) {
            o.scores.remove(e);
            return null;
        }
        int v;
        try {
            v = Integer.parseInt(op.a("value"));
        } catch (NumberFormatException ex) {
            return "Der Wert \"" + op.a("value") + "\" ist keine ganze Zahl.";
        }
        if (!o.scores.containsKey(e) && o.scores.size() >= MAX_ENTRIES_PER_OBJECTIVE) return "Zu viele Eintraege in diesem Objective (hoechstens " + MAX_ENTRIES_PER_OBJECTIVE + ").";
        long result = mode == 1 ? (long) o.scores.getOrDefault(e, 0) + v : v;
        if (result > Integer.MAX_VALUE || result < Integer.MIN_VALUE) return "Der Wert ist zu gross.";
        o.scores.put(e, (int) result);
        return null;
    }

    private String createTeam(Op op) {
        String n = name(op.a("name"));
        if (teams.containsKey(n)) return "Das Team \"" + n + "\" gibt es schon.";
        Team t = new Team();
        t.name = n;
        t.display = text(op.a("display"), 64);
        t.owned = true;
        if (!op.a("color").isEmpty()) {
            if (!COLORS.contains(op.a("color"))) return "Unbekannte Farbe: " + op.a("color");
            t.color = op.a("color");
        }
        teams.put(n, t);
        return null;
    }

    private String setTeam(Op op) {
        Team t = team(op.a("name"));
        String v = op.a("value");
        switch (op.a("key")) {
            case "display" -> t.display = text(v, 64);
            case "color" -> {
                if (!v.isEmpty() && !COLORS.contains(v)) return "Unbekannte Farbe: " + v;
                t.color = v;
            }
            case "prefix" -> t.prefix = text(v, 16);
            case "suffix" -> t.suffix = text(v, 16);
            case "friendlyFire" -> t.friendlyFire = Boolean.parseBoolean(v);
            case "seeInvisible" -> t.seeInvisible = Boolean.parseBoolean(v);
            case "nametag" -> {
                if (!VISIBILITY.contains(v)) return "Unbekannte Sichtbarkeit: " + v;
                t.nametag = v;
            }
            case "collision" -> {
                if (!COLLISION.contains(v)) return "Unbekannte Kollision: " + v;
                t.collision = v;
            }
            default -> {
                return "Unbekannte Team-Einstellung: " + op.a("key");
            }
        }
        return null;
    }

    /** Kurze Beschreibung einer Aenderung fuer die Liste im Web. */
    public static String describe(Op op) {
        return switch (op.type == null ? "" : op.type) {
            case "objective.create" -> "Objective anlegen: " + op.a("name") + " (" + (op.a("criteria").isEmpty() ? "dummy" : op.a("criteria")) + ")";
            case "objective.delete" -> "Objective loeschen: " + op.a("name");
            case "objective.display" -> "Anzeigename von " + op.a("name") + ": \"" + op.a("display") + "\"";
            case "objective.render" -> "Darstellung von " + op.a("name") + ": " + op.a("render");
            case "slot.set" -> "Platz " + op.a("slot") + ": " + (op.a("objective").isEmpty() ? "leer" : op.a("objective"));
            case "score.set" -> op.a("entry") + " in " + op.a("objective") + " = " + op.a("value");
            case "score.add" -> op.a("entry") + " in " + op.a("objective") + " " + (op.a("value").startsWith("-") ? "" : "+") + op.a("value");
            case "score.reset" -> op.a("entry") + " in " + op.a("objective") + " zuruecksetzen";
            case "team.create" -> "Team anlegen: " + op.a("name");
            case "team.delete" -> "Team loeschen: " + op.a("name");
            case "team.set" -> "Team " + op.a("name") + ": " + op.a("key") + " = " + op.a("value");
            case "team.add" -> op.a("entry") + " ins Team " + op.a("name");
            case "team.remove" -> op.a("entry") + " aus Team " + op.a("name");
            default -> String.valueOf(op.type);
        };
    }

    public static List<Op> copyOps(List<Op> ops) {
        return new ArrayList<>(ops);
    }
}
