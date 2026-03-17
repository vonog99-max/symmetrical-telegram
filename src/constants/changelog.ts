export interface ChangelogEntry {
  version: string;
  date: string;
  features: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.01",
    date: "2026-03-14",
    features: [
      "Added SoundBoard feature on VC with spam toggle and interval control",
      "Added .spamsb <count> [interval] command for mass soundboard spamming",
      "Added SoundBoard test audio functionality in the dashboard",
      "Integrated Gemini 2.5 Flash TTS (Text-to-Speech) for Voice Channels",
      "Fixed camera/video functionality on VC for better stability",
      "Added Voice category to the .help menu (Category 7)",
      "Added .leavevc command to quickly disconnect from all voice channels",
      "Updated UI components for better responsiveness and clarity"
    ]
  },
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
