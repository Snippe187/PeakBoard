package de.peakverse.peakboard;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.logging.Logger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DisplayTest {
    @Test
    void legacyAndNamedColorsBecomeSpans() {
        List<Fmt.Span> s = Fmt.parse("&aGruen <red>Rot</red> &c&lFett");
        assertEquals("Gruen Rot Fett", Fmt.plain(s));
        assertEquals(0x55FF55, s.get(0).color());
        assertEquals(0xFF5555, s.get(1).color());
        assertEquals(-1, s.get(2).color());
        Fmt.Span last = s.get(s.size() - 1);
        assertEquals(0xFF5555, last.color());
        assertEquals(Fmt.B, last.flags());
    }

    @Test
    void colorCodeResetsStyles() {
        List<Fmt.Span> s = Fmt.parse("&lA&bB");
        assertEquals(Fmt.B, s.get(0).flags());
        assertEquals(0, s.get(1).flags());
    }

    @Test
    void hexColorsWork() {
        assertEquals(0xFF8800, Fmt.parse("&#ff8800X").get(0).color());
        assertEquals(0x123456, Fmt.parse("<#123456>X").get(0).color());
    }

    @Test
    void gradientColorsEveryLetter() {
        List<Fmt.Span> s = Fmt.parse("<gradient:#000000:#ffffff>abc</gradient>!");
        assertEquals("abc!", Fmt.plain(s));
        assertEquals(0x000000, s.get(0).color());
        assertEquals(0x808080, s.get(1).color());
        assertEquals(0xFFFFFF, s.get(2).color());
        assertEquals(-1, s.get(3).color());
        assertEquals(0xFF5555, Fmt.parse("<gradient:rot:blau>x</gradient>").get(0).color() == 0xFF5555 ? 0xFF5555 : 0);
    }

    @Test
    void rainbowAndGermanNames() {
        List<Fmt.Span> s = Fmt.parse("<rainbow>abcd</rainbow>");
        assertEquals("abcd", Fmt.plain(s));
        assertTrue(s.size() >= 3);
        assertEquals(0xFF5555, Fmt.parse("<rot>x").get(0).color());
    }

    @Test
    void unknownTagsAndBrokenInputStayText() {
        assertEquals("a <foo> b", Fmt.plain(Fmt.parse("a <foo> b")));
        assertEquals("1 < 2 > 0", Fmt.plain(Fmt.parse("1 < 2 > 0")));
        assertEquals("<gradient:rot>x", Fmt.plain(Fmt.parse("<gradient:rot>x")));
        assertEquals("100%", Fmt.plain(Fmt.parse("100%")));
        assertEquals("", Fmt.plain(Fmt.parse(null)));
        assertEquals("&", Fmt.plain(Fmt.parse("&")));
    }

    @Test
    void nestingDepthIsLimited() {
        String deep = "<gradient:red:blue>".repeat(20) + "x" + "</gradient>".repeat(20);
        assertNotNull(Fmt.parse(deep));
    }

    @Test
    void placeholdersAreReplacedAndUnknownOnesStay() {
        Placeholders.Values v = key -> key.equals("player") ? "Steve" : key.startsWith("score:") ? "9" : null;
        assertEquals("Hi Steve, 9 Punkte, %nix% 50%", Placeholders.resolve("Hi %player%, %score:Kills% Punkte, %nix% 50%", v));
        assertEquals("", Placeholders.resolve(null, v));
        assertEquals("%", Placeholders.resolve("%", v));
        assertEquals("%%", Placeholders.resolve("%%", v));
    }

    @Test
    void sampleValuesCoverTheCatalog() {
        Placeholders.Values s = Placeholders.samples();
        for (Placeholders.Entry e : Placeholders.CATALOG) assertNotNull(s.get(e.key()), e.key());
        assertEquals("Alex", s.get("top:Kills:1"));
        assertEquals("42", s.get("topval:Kills:1"));
        assertNull(s.get("gibtsnicht"));
    }

    @Test
    void everyTemplateIsValidAndResolvesWithSamples() {
        for (DisplayTemplates.Template t : DisplayTemplates.all()) {
            DisplayModel m = t.model().copy();
            assertNull(m.normalize(), t.id());
            assertFalse(m.pages.isEmpty(), t.id());
            for (DisplayModel.Page p : m.pages) {
                for (String line : p.lines) {
                    String r = Placeholders.resolve(line, Placeholders.samples());
                    assertFalse(r.matches(".*%[a-z]+(:[A-Za-z0-9]+)*%.*"), t.id() + ": " + r);
                    assertNotNull(Fmt.parse(r));
                }
            }
        }
    }

    @Test
    void normalizeClampsAndRejects() {
        DisplayModel m = new DisplayModel();
        m.rotateSeconds = 0;
        m.refreshTicks = 100000;
        m.titleFrameTicks = 1;
        m.pages.add(new DisplayModel.Page("", List.of("t"), List.of("x".repeat(500))));
        assertNull(m.normalize());
        assertEquals(3, m.rotateSeconds);
        assertEquals(200, m.refreshTicks);
        assertEquals(5, m.titleFrameTicks);
        assertEquals(DisplayModel.MAX_TEXT, m.pages.get(0).lines.get(0).length());
        assertEquals("Seite 1", m.pages.get(0).name);

        DisplayModel tooMany = new DisplayModel();
        for (int i = 0; i < DisplayModel.MAX_LINES + 1; i++) tooMany.pages.isEmpty();
        tooMany.pages.add(new DisplayModel.Page("a", List.of("t"), java.util.Collections.nCopies(DisplayModel.MAX_LINES + 1, "x")));
        assertTrue(tooMany.normalize().contains("zu viele Zeilen"));

        DisplayModel badPerm = new DisplayModel();
        DisplayModel.Page p = new DisplayModel.Page("a", List.of("t"), List.of());
        p.permission = "../../x y";
        badPerm.pages.add(p);
        assertTrue(badPerm.normalize().contains("Recht"));
    }

    @Test
    void pagesRotateByTimeAndRespectPermissions() {
        DisplayModel m = new DisplayModel();
        m.rotateSeconds = 10;
        for (String n : List.of("A", "B", "C")) m.pages.add(new DisplayModel.Page(n, List.of("t"), List.of()));
        assertEquals(0, m.pageIndexAt(0, p -> true));
        assertEquals(1, m.pageIndexAt(10_000, p -> true));
        assertEquals(2, m.pageIndexAt(25_000, p -> true));
        assertEquals(0, m.pageIndexAt(30_000, p -> true));
        assertEquals(2, m.pageIndexAt(10_000, p -> !p.name.equals("B")));
        assertEquals(-1, m.pageIndexAt(0, p -> false));
        assertEquals(-1, new DisplayModel().pageIndexAt(0, p -> true));
    }

    @Test
    void titleFramesAnimate() {
        DisplayModel m = new DisplayModel();
        m.titleFrameTicks = 10;
        DisplayModel.Page p = new DisplayModel.Page("a", List.of("1", "2"), List.of());
        assertEquals(0, m.titleFrameAt(p, 0));
        assertEquals(1, m.titleFrameAt(p, 500));
        assertEquals(0, m.titleFrameAt(p, 1000));
        assertEquals(0, m.titleFrameAt(new DisplayModel.Page("b", List.of("x"), List.of()), 777));
    }

    @Test
    void storeSavesKeepsABackupAndRemembersWhoTurnedItOff(@TempDir Path dir) {
        DisplayStore store = new DisplayStore(dir, Logger.getAnonymousLogger());
        store.load();
        DisplayModel m = DisplayTemplates.all().get(0).model().copy();
        assertNull(store.save(m));
        m.pages.get(0).name = "Neu";
        assertNull(store.save(m));
        assertTrue(java.nio.file.Files.exists(dir.resolve("display.json.bak")));

        DisplayStore again = new DisplayStore(dir, Logger.getAnonymousLogger());
        again.load();
        assertEquals("Neu", again.model().pages.get(0).name);

        UUID id = UUID.randomUUID();
        assertTrue(again.toggleOff(id));
        DisplayStore third = new DisplayStore(dir, Logger.getAnonymousLogger());
        third.load();
        assertTrue(third.isOff(id));
        assertFalse(third.toggleOff(id));
        assertFalse(third.isOff(id));

        DisplayModel bad = new DisplayModel();
        for (int i = 0; i < DisplayModel.MAX_PAGES + 1; i++) bad.pages.add(new DisplayModel.Page("p", List.of("t"), List.of()));
        assertTrue(again.save(bad).contains("Seiten"));
        assertEquals("Neu", again.model().pages.get(0).name);
    }
}
