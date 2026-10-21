/**
 * Minimal ambient types for the Google Cast Web Sender SDK.
 * No complete maintained @types package exists; this covers only what
 * chromecast.ts uses. See developers.google.com/cast/docs/web_sender.
 */

interface CastFrameworkRemotePlayer {
  currentTime: number;
  duration: number;
  isPaused: boolean;
  isMuted: boolean;
  volumeLevel: number;
  title: string | null;
  mediaInfo: { contentUrl?: string; contentType?: string } | null;
}

interface CastFrameworkRemotePlayerController {
  getRemotePlayer(): CastFrameworkRemotePlayer;
  playOrPause(): void;
  seek(): void;
  stop(): void;
  setVolumeLevel(): void;
  muteOrUnmute(): void;
}

interface CastMediaInfo {
  contentId: string;
  contentType: string;
  streamType?: "BUFFERED" | "LIVE";
  metadata?: { type: number; title?: string };
  textTrackStyle?: unknown;
  tracks?: Array<{ trackId: number; type: "TEXT"; content: string; contentType: string; name: string; subtype?: string }>;
}

interface CastLoadRequest {
  contentId: string;
  contentType: string;
  streamType?: string;
  metadata?: { type: number; title?: string };
  currentTime?: number;
  autoplay?: boolean;
}

interface CastMedia {
  media?: CastMediaInfo;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(request: { currentTime: number }): Promise<void>;
  setVolume(request: { level?: number; muted?: boolean }): Promise<void>;
}

interface CastSession {
  sessionId: string;
  getSessionObj(): { media: CastMedia[] };
  loadMedia(request: CastLoadRequest): Promise<chrome.cast.Media | null>;
  endSession(cstop: boolean): void;
  addEventListener(type: string, handler: () => void): void;
}

interface CastSessionStateChangeListenerDetail {
  sessionState: cast.framework.SessionState;
}

interface CastContext {
  setOptions(options: {
    receiverApplicationId: string;
    autoJoinPolicy: string;
    language?: string;
  }): void;
  requestSession(): Promise<cast.framework.Session>;
  getCurrentSession(): cast.framework.Session | null;
  getSessionState(): cast.framework.SessionState;
  addEventListener(
    type: cast.framework.CastContextEventType,
    handler: (detail: CastSessionStateChangeListenerDetail) => void
  ): void;
  removeEventListener(
    type: cast.framework.CastContextEventType,
    handler: (detail: CastSessionStateChangeListenerDetail) => void
  ): void;
}

declare namespace cast.framework {
  enum SessionState {
    NO_SESSION = "no_session",
    SESSION_STARTED = "session_started",
    SESSION_STARTING = "session_starting",
    SESSION_START_FAILED = "session_start_failed",
    SESSION_RESUMED = "session_resumed",
    SESSION_ENDING = "session_ending",
    SESSION_ENDED = "session_ended",
  }
  type CastContextEventType = "caststatechanged" | "sessionstatechanged";
  const CastContext: { getInstance(): CastContext };
  class RemotePlayer implements CastFrameworkRemotePlayer {
    currentTime: number;
    duration: number;
    isPaused: boolean;
    isMuted: boolean;
    volumeLevel: number;
    title: string | null;
    mediaInfo: { contentUrl?: string; contentType?: string } | null;
  }
  class RemotePlayerController {
    constructor(player: RemotePlayer);
    getRemotePlayer(): RemotePlayer;
    playOrPause(): void;
    seek(): void;
    stop(): void;
    setVolumeLevel(): void;
    muteOrUnmute(): void;
  }
}

declare namespace chrome.cast {
  namespace media {
    const DEFAULT_MEDIA_RECEIVER_APP_ID: string;
  }
  namespace AutoJoinPolicy {
    const ORIGIN_SCOPED: string;
  }
  interface Media {
    sessionId: string;
    mediaId: number;
  }
  interface LoadRequest extends CastLoadRequest {}
}

interface Window {
  cast?: {
    framework?: typeof cast.framework;
  };
  chrome?: {
    cast?: typeof chrome.cast;
  };
  __onGCastApiAvailable?: (available: boolean, reason?: string) => void;
}
