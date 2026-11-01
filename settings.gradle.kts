rootProject.name = "peakboard"

// PeakCore liegt als eigenes Projekt daneben; die API (core-api) wird direkt daraus bezogen (Composite Build)
includeBuild("../PeakCore")
