package de.peakverse.peakboard;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import de.peakverse.peakboard.BoardModel.Op;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/** Der Entwurf (gesammelte Aenderungen) in {@code draft.json}: ueberlebt einen Neustart, bis er veroeffentlicht oder verworfen wird. */
public final class BoardStore {
    public static final int MAX_DRAFT = 500;

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private final Path file;
    private final Logger logger;
    private final List<Op> draft = new ArrayList<>();

    public BoardStore(Path dataFolder, Logger logger) {
        this.file = dataFolder.resolve("draft.json");
        this.logger = logger;
    }

    public synchronized void load() {
        draft.clear();
        if (!Files.isRegularFile(file)) return;
        try (Reader r = Files.newBufferedReader(file)) {
            List<Op> list = GSON.fromJson(r, new TypeToken<List<Op>>() { }.getType());
            if (list != null) draft.addAll(list);
        } catch (IOException | RuntimeException e) {
            logger.log(Level.SEVERE, "draft.json konnte nicht gelesen werden (Datei bleibt liegen)", e);
        }
    }

    private void save() {
        try {
            Files.createDirectories(file.getParent());
            Path tmp = file.resolveSibling("draft.json.tmp");
            try (Writer w = Files.newBufferedWriter(tmp)) {
                GSON.toJson(draft, w);
            }
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            logger.log(Level.SEVERE, "draft.json konnte nicht gespeichert werden", e);
        }
    }

    public synchronized List<Op> draft() {
        return new ArrayList<>(draft);
    }

    /** Haengt Aenderungen an, aber nur, wenn der ganze Entwurf danach noch auf {@code live} anwendbar ist. @return Fehlermeldung oder {@code null} */
    public synchronized String add(BoardModel live, List<Op> ops) {
        if (ops.isEmpty()) return "Keine Aenderung angegeben.";
        if (draft.size() + ops.size() > MAX_DRAFT) return "Der Entwurf ist voll (hoechstens " + MAX_DRAFT + " Aenderungen). Bitte zuerst veroeffentlichen.";
        List<Op> all = new ArrayList<>(draft);
        all.addAll(ops);
        String err = live.copy().applyAll(all);
        if (err != null) return err;
        draft.addAll(ops);
        save();
        return null;
    }

    /** Nimmt eine Aenderung heraus, sofern der Rest danach noch gilt (Folge-Aenderungen koennen davon abhaengen). */
    public synchronized String remove(BoardModel live, int index) {
        if (index < 0 || index >= draft.size()) return "Diese Aenderung gibt es nicht.";
        List<Op> rest = new ArrayList<>(draft);
        rest.remove(index);
        String err = live.copy().applyAll(rest);
        if (err != null) return "Das geht nicht, weil spaetere Aenderungen darauf aufbauen (" + err + "). Verwirf stattdessen den ganzen Entwurf oder zuerst die spaeteren.";
        draft.remove(index);
        save();
        return null;
    }

    public synchronized void clear() {
        draft.clear();
        save();
    }
}
