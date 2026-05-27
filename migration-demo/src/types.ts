export interface LatencyEntry {
  /** Latency in milliseconds */
  latency: number;
  /** ISO timestamp when the check was performed */
  timestamp: string;
}

export interface WCDHistory {
  contentLastCheckedAt: string | null;
  contentLastChangedAt: string | null;
  latencies: LatencyEntry[];
}

export interface WCDWorkflowParams {
  /** ID/label for this workflow run, for display */
  id: string;
  /** URL to monitor for changes */
  url: string;
  /** Time between checks for change, in seconds */
  sleepInterval: number;
  /** Optional pre-loaded state used to seed a migrated workflow */
  history?: WCDHistory;
  /** If true, exit immediately after setting up handlers (used to seed closed workflows) */
  closeImmediately?: boolean;
}

export interface WCDQueryResult {
  id: string;
  url: string;
  /** Seconds between checks; surfaced so the UI can migrate without local metadata */
  sleepInterval: number;
  /** ISO timestamp of the last time the content was checked */
  contentLastCheckedAt: string | null;
  /** ISO timestamp of the last time the content was changed */
  contentLastChangedAt: string | null;
  /** Latencies (in ms) and timestamps from each check (max 100 entries in the array)  */
  latencies: LatencyEntry[];
}
