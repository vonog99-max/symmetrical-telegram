export interface ChangelogEntry {
  version: string;
  date: string;
  features: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.0.0",
    date: "2026-03-11",
    features: [
      "Initial stable release",
      "Fixed VC Screenshare (Go Live) functionality",
      "Added Status Rotator with custom intervals",
      "Added Alt Token Importer for mass control",
      "Added RPC (Rich Presence) customizer",
      "Added Changelog system",
      "Improved UI with dark fantasy theme",
      "Added 24/7 Video/YouTube/Image streaming to VC",
      "Optimized stream monitor for better stability"
    ]
  }
];
