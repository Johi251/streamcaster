import { SignalingClient, type SignalingHandlers } from "@streamcaster/shared";

/**
 * Receiver's signaling client.
 *
 * `handlers` stays private in the base class — redeclaring it as public here
 * is a TS2415 (incompatible override). The subclass only adds a name.
 */
export class ReceiverClient extends SignalingClient {
  constructor(baseUrl: string, handlers: SignalingHandlers) {
    super(baseUrl, handlers);
  }
}