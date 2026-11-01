package de.peakverse.peakboard;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

/** Speichert die Anzeige in {@code display.json} und merkt sich in {@code display-off.txt}, welche Spieler sie fuer sich ausgeschaltet haben. */
public final class DisplayStore {
    private final Path file, offFile;
    private final Logger logger;
    private DisplayModel model = new DisplayModel();
    private final Set<UUID> off = new HashSet<>();

    public DisplayStore(Path dataFolder, Logger logger) {
        this.file = dataFolder.resolve("display.json");
        this.offFile = dataFolder.resolve("display-off.txt");
        this.logger = logger;
    }

    public synchronized void load() {
        model = new DisplayModel();
        if (Files.isRegularFile(file)) {
            try {
                DisplayModel m = DisplayModel.fromJson(Files.readString(file, StandardCharsets.UTF_8));
                String err = m.normalize();
                if (err == null) model = m;
                else logger.warning("display.json ist ungueltig (" + err + "), die Anzeige bleibt aus.");
            } catch (IOException | RuntimeException e) {
                logger.log(Level.SEVERE, "display.json konnte nicht gelesen werden (Datei bleibt liegen)", e);
            }
        }
        off.clear();
        if (Files.isRegularFile(offFile)) {
            try {
                for (String line : Files.readAllLines(offFile, StandardCharsets.UTF_8)) {
                    try {
                        off.add(UUID.fromString(line.strip()));
                    } catch (IllegalArgumentException ignored) {
                        // kaputte Zeile
                    }
                }
            } catch (IOException e) {
                logger.log(Level.WARNING, "display-off.txt konnte nicht gelesen werden", e);
            }
        }
    }

    public synchronized DisplayModel model() {
        return model.copy();
    }

    /** Speichert eine neue Anzeige (nachdem sie geprueft wurde); die vorige bleibt als {@code display.json.bak} liegen. @return Fehlermeldung oder {@code null} */
    public synchronized String save(DisplayModel next) {
        String err = next.normalize();
        if (err != null) return err;
        try {
            Files.createDirectories(file.getParent());
            if (Files.isRegularFile(file)) Files.copy(file, file.resolveSibling("display.json.bak"), StandardCopyOption.REPLACE_EXISTING);
            Path tmp = file.resolveSibling("display.json.tmp");
            Files.writeString(tmp, next.toJson(), StandardCharsets.UTF_8);
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            logger.log(Level.SEVERE, "display.json konnte nicht gespeichert werden", e);
            return "Speichern ging schief: " + e.getMessage();
        }
        model = next.copy();
        return null;
    }

    public synchronized boolean isOff(UUID id) {
        return off.contains(id);
    }

    /** Schaltet die Anzeige fuer einen Spieler um. @return {@code true}, wenn sie danach aus ist */
    public synchronized boolean toggleOff(UUID id) {
        boolean nowOff = off.add(id);
        if (!nowOff) off.remove(id);
        try {
            Files.createDirectories(offFile.getParent());
            Files.write(offFile, off.stream().map(UUID::toString).toList(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.log(Level.WARNING, "display-off.txt konnte nicht gespeichert werden", e);
        }
        return nowOff;
    }
}
