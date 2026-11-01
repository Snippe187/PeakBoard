package de.peakverse.peakboard;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import de.peakverse.peakboard.BoardModel.Op;
import java.util.List;
import org.junit.jupiter.api.Test;

class BoardModelTest {
    private final BoardModel m = new BoardModel();

    private void ok(Op op) {
        assertNull(m.apply(op), BoardModel.describe(op));
    }

    @Test
    void objectivesScoresAndSlots() {
        ok(new Op("objective.create", "name", "kills", "criteria", "playerKillCount", "display", "Kills"));
        assertTrue(m.objectives.get("kills").owned);
        ok(new Op("score.set", "objective", "kills", "entry", "Neo", "value", "5"));
        ok(new Op("score.add", "objective", "kills", "entry", "Neo", "value", "-2"));
        ok(new Op("score.add", "objective", "kills", "entry", "Max", "value", "7"));
        assertEquals(3, m.objectives.get("kills").scores.get("Neo"));
        assertEquals(7, m.objectives.get("kills").scores.get("Max"));
        ok(new Op("slot.set", "slot", "sidebar", "objective", "kills"));
        assertEquals("kills", m.slots.get("sidebar"));
        ok(new Op("score.reset", "objective", "kills", "entry", "Neo"));
        assertFalse(m.objectives.get("kills").scores.containsKey("Neo"));
    }

    @Test
    void deletingAnObjectiveClearsItsSlots() {
        ok(new Op("objective.create", "name", "x"));
        ok(new Op("slot.set", "slot", "list", "objective", "x"));
        ok(new Op("objective.delete", "name", "x"));
        assertTrue(m.slots.isEmpty());
        assertTrue(m.objectives.isEmpty());
    }

    @Test
    void badInputIsRefusedAndLeavesTheModelUntouched() {
        assertNotNull(m.apply(new Op("objective.create", "name", "Hat Leerzeichen")));
        assertNotNull(m.apply(new Op("objective.create", "name", "../x")));
        assertNotNull(m.apply(new Op("objective.create", "name", "ok", "criteria", "a b")));
        assertNotNull(m.apply(new Op("score.set", "objective", "gibtsnicht", "entry", "a", "value", "1")));
        ok(new Op("objective.create", "name", "ok"));
        assertNotNull(m.apply(new Op("objective.create", "name", "ok")), "doppelt");
        assertNotNull(m.apply(new Op("score.set", "objective", "ok", "entry", "a", "value", "abc")));
        ok(new Op("score.add", "objective", "ok", "entry", "a", "value", "2147483647"));
        assertNotNull(m.apply(new Op("score.add", "objective", "ok", "entry", "a", "value", "1")), "Ueberlauf");
        assertNotNull(m.apply(new Op("slot.set", "slot", "mitte", "objective", "ok")));
        assertNotNull(m.apply(new Op("zaubern")));
        assertNotNull(m.apply(null));
    }

    @Test
    void teamsMembersAndSettings() {
        ok(new Op("team.create", "name", "rot", "color", "red"));
        ok(new Op("team.add", "name", "rot", "entry", "Neo"));
        ok(new Op("team.create", "name", "blau", "color", "blue"));
        assertNotNull(m.apply(new Op("team.add", "name", "blau", "entry", "Neo")), "ein Spieler nur in einem Team");
        ok(new Op("team.set", "name", "rot", "key", "prefix", "value", "[R] "));
        ok(new Op("team.set", "name", "rot", "key", "friendlyFire", "value", "false"));
        assertFalse(m.teams.get("rot").friendlyFire);
        assertNotNull(m.apply(new Op("team.set", "name", "rot", "key", "color", "value", "neon")));
        assertNotNull(m.apply(new Op("team.set", "name", "rot", "key", "prefix", "value", "viel zu langer Praefix")));
        ok(new Op("team.remove", "name", "rot", "entry", "Neo"));
        ok(new Op("team.delete", "name", "rot"));
        assertFalse(m.teams.containsKey("rot"));
    }

    @Test
    void copyIsIndependent() {
        ok(new Op("objective.create", "name", "a"));
        BoardModel c = m.copy();
        assertNull(c.apply(new Op("objective.delete", "name", "a")));
        assertTrue(m.objectives.containsKey("a"));
    }

    @Test
    void foreignThingsNeedConfirmation() {
        BoardModel.Objective foreign = new BoardModel.Objective();
        foreign.name = "andere";
        m.objectives.put("andere", foreign);
        ok(new Op("objective.create", "name", "meins"));
        assertTrue(m.touchesForeign(new Op("objective.delete", "name", "andere")));
        assertTrue(m.touchesForeign(new Op("score.set", "objective", "andere", "entry", "x", "value", "1")));
        assertTrue(m.touchesForeign(new Op("slot.set", "slot", "sidebar", "objective", "andere")));
        assertFalse(m.touchesForeign(new Op("objective.delete", "name", "meins")));
        assertFalse(m.touchesForeign(new Op("objective.create", "name", "neu")));
    }

    @Test
    void applyAllStopsAtTheFirstErrorWithItsNumber() {
        String err = m.applyAll(List.of(new Op("objective.create", "name", "a"), new Op("objective.create", "name", "a")));
        assertNotNull(err);
        assertTrue(err.startsWith("Aenderung 2"));
    }
}
