#!/usr/bin/env bash
# Install the subset of ffmpeg's `make install` that this project consumes.
#
# ffmpeg's own install-headers target hands ~100 absolute paths to a single
# `install` invocation. On Windows that call goes through cmd.exe, whose command
# line is capped at 8191 characters, so the tail of the argument list is cut off
# and the step dies with `install: target 'c:/Users/johan/s' is not a directory`.
# Copying the files ourselves is shorter, deterministic and identical on every
# host, so both the Windows and the Linux build use this path.
set -eu

src="$1"    # ffmpeg source tree
build="$2"  # ffmpeg build tree (holds the generated headers)
dest="$3"   # install prefix

mkdir -p "$dest/lib" "$dest/include/libavutil" "$dest/include/libavcodec"

cp "$build/libavcodec/libavcodec.a" "$build/libavutil/libavutil.a" "$dest/lib/"

for f in "$src"/libavutil/*.h; do cp "$f" "$dest/include/libavutil/"; done
for f in "$src"/libavcodec/*.h; do cp "$f" "$dest/include/libavcodec/"; done

# configure generates these two into the build tree; install-headers ships them too
cp "$build"/libavutil/avconfig.h "$build"/libavutil/ffversion.h "$dest/include/libavutil/"
