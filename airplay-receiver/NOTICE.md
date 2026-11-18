# Third-party notices

StreamCaster Receiver is derived from
[jqssun/android-airplay-server](https://github.com/jqssun/android-airplay-server)
at commit `a46cca0a6a1274e9e33c0e750f0f1c1eb1d881ea` (GPL-3.0).

The AirPlay/RAOP implementation is
[UxPlay](https://github.com/FDH2/UxPlay) at commit
`df67c212a433cf6dda3676dd40c097900d24e645` (GPL-3.0), patched by the
upstream Android project.

Additional native components:

| Component | Commit | License |
|---|---|---|
| UxPlay | `df67c212a433cf6dda3676dd40c097900d24e645` | GPL-3.0 |
| libplist | `f41b1ea67045e0c09339974d83e389972d84f166` | LGPL-2.1 |
| openssl-cmake / OpenSSL | `4edd36a8dab5f85a8f92650b5bdf6e0cab13aab8` / 3.4.4 | Apache-2.0 |
| FFmpeg | `38b88335f99e76ed89ff3c93f877fdefce736c13` | LGPL-2.1+ (build enables only ALAC/AAC decoders) |

Android/Kotlin libraries: AndroidX, Media3/ExoPlayer (Apache-2.0),
OkHttp (Apache-2.0), Oboe (Apache-2.0), Hilt/Dagger (Apache-2.0).

StreamCaster changes (GPL-3.0, this repository):

- `com.streamcaster.receiver` hub, room code and signaling client
- `CastPlayerActivity` with Media3 URL/HLS/VTT playback
- StreamCaster branding, German UI, launcher and icons
- arm64-only release build
- CMake: removed unquotable `-ffile-prefix-map` flags, capped FFmpeg jobs

The complete corresponding source is this repository, including the
submodules listed above and the patches under
`app/src/main/cpp/patches/UxPlay`.
