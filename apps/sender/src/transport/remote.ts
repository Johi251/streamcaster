/**
 * Transport arbitration: routes remote commands either to the receiver-page
 * session (signaling) or to an active Chromecast session. One `RemoteState`
 * feeds the sender UI either way.
 */

import type { ChromecastSender } from "../cast/chromecast.js";
import type { CastCommands, RemoteState } from "./cast.js";

export class RemoteTransport {
  castActive = false;
  private stateCb: ((s: RemoteState) => void) | null = null;

  constructor(
    private readonly commands: CastCommands | null,
    private readonly cc: ChromecastSender | null
  ) {
    cc?.onState((s) => {
      if (this.castActive) this.stateCb?.(s);
    });
  }

  onState(cb: (s: RemoteState) => void): void {
    this.stateCb = cb;
  }

  get target(): "chromecast" | "receiver" | "none" {
    if (this.castActive) return "chromecast";
    return this.commands ? "receiver" : "none";
  }

  load(url: string, title?: string, mime?: string): void {
    if (this.castActive && this.cc) void this.cc.send({ name: "load", url, title, mime });
    else this.commands?.load(url, title, mime);
  }

  play(): void {
    if (this.castActive && this.cc) void this.cc.send({ name: "play" });
    else this.commands?.play();
  }

  pause(): void {
    if (this.castActive && this.cc) void this.cc.send({ name: "pause" });
    else this.commands?.pause();
  }

  seek(time: number): void {
    if (this.castActive && this.cc) void this.cc.send({ name: "seek", time });
    else this.commands?.seek(time);
  }

  volume(value: number): void {
    if (this.castActive && this.cc) void this.cc.send({ name: "volume", value });
    else this.commands?.volume(value);
  }

  stop(): void {
    if (this.castActive && this.cc) void this.cc.send({ name: "stop" });
    else this.commands?.stop();
  }

  subtitle(content: string, label?: string): void {
    if (this.castActive) return; // unsupported over Cast (v1)
    this.commands?.subtitle(content, label);
  }

  fileMeta(name: string, size: number, mime: string): void {
    this.commands?.fileMeta(name, size, mime);
  }

  streamStart(kind: "screen" | "camera"): void {
    this.commands?.streamStart(kind);
  }

  streamStop(): void {
    this.commands?.streamStop();
  }
}
