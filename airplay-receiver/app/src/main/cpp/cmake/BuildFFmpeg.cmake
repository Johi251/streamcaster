# build minimal static ffmpeg (libavcodec + libavutil + ALAC + AAC decoders) and expose under ffmpeg::avcodec and ffmpeg::avutil

include(ExternalProject)
include(ProcessorCount)

if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(_ffmpeg_arch aarch64)
    set(_ffmpeg_triple aarch64-linux-android)
elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
    set(_ffmpeg_arch arm)
    set(_ffmpeg_triple armv7a-linux-androideabi)
    set(_ffmpeg_cpu --cpu=armv7-a)
elseif(ANDROID_ABI STREQUAL "x86_64")
    set(_ffmpeg_arch x86_64)
    set(_ffmpeg_triple x86_64-linux-android)
elseif(ANDROID_ABI STREQUAL "x86")
    set(_ffmpeg_arch x86)
    set(_ffmpeg_triple i686-linux-android)
else()
    message(FATAL_ERROR "BuildFFmpeg: unhandled ABI ${ANDROID_ABI}")
endif()

# NDK's per-API clang wrappers live next to the generic clang driver
get_filename_component(_ffmpeg_tc "${CMAKE_C_COMPILER}" DIRECTORY)

ProcessorCount(_ffmpeg_jobs)
if(_ffmpeg_jobs EQUAL 0)
    set(_ffmpeg_jobs 4)
endif()
# keep the native build inside a modest RAM budget
if(_ffmpeg_jobs GREATER 4)
    set(_ffmpeg_jobs 4)
endif()

set(FFMPEG_INSTALL ${CMAKE_BINARY_DIR}/ffmpeg)

# configure is a POSIX shell script; Windows needs bash from Git for Windows and
# the GNU make shipped with the NDK.
if(CMAKE_HOST_WIN32)
    find_program(FFMPEG_BASH NAMES bash HINTS "C:/Program Files/Git/usr/bin" "C:/Program Files/Git/bin")
    find_program(FFMPEG_MAKE NAMES make HINTS "${ANDROID_NDK}/prebuilt/windows-x86_64/bin")
    if(NOT FFMPEG_BASH OR NOT FFMPEG_MAKE)
        message(FATAL_ERROR "Windows build needs Git Bash and the NDK's make.exe (found bash=${FFMPEG_BASH}, make=${FFMPEG_MAKE})")
    endif()
else()
    find_program(FFMPEG_BASH NAMES bash REQUIRED)
    find_program(FFMPEG_MAKE NAMES make REQUIRED)
endif()

# instrument ffmpeg with the same sanitizers; built with --disable-asm
set(_ffmpeg_sanitize "")
if(SANITIZE)
    string(REPLACE ";" " " _ff_scflags "${SANITIZE_CFLAGS}")
    string(REPLACE ";" " " _ff_sldflags "${SANITIZE_LDFLAGS}")
    set(_ffmpeg_sanitize "--extra-cflags=${_ff_scflags}" "--extra-ldflags=${_ff_sldflags}")
endif()

# Windows/MSYS only: ffmpeg's configure probes break on a plain Windows host.
#   --tempprefix=.   Git Bash's `mktemp -d` hands back a path MSYS cannot write
#                    into ("Unable to create temporary file in /tmp/ffconf.*").
#                    ffmpeg's own escape hatch keeps the probe files relative.
#   --host-cc=...    A plain Windows box has no host gcc/g++, so ffmpeg's host
#                    C11 probe fails. Building libs only *compiles* those probes
#                    (never executes them), so the NDK clang satisfies the check.
# On Linux both are counterproductive: --host-cc would point the host probes at
# the *target* compiler, and /tmp works fine.
if(CMAKE_HOST_WIN32)
    set(_ffmpeg_host_workarounds
        --tempprefix=.
        --host-cc=${_ffmpeg_tc}/${_ffmpeg_triple}${AIRPLAY_ANDROID_API}-clang
    )
    # configure writes MSYS drive paths into its generated files, but the NDK's
    # make.exe is a native Windows binary and cannot resolve them.
    set(_ffmpeg_fix_paths
        COMMAND ${CMAKE_COMMAND}
            -DWORKDIR=${CMAKE_BINARY_DIR}/ffmpeg-ep/src/ffmpeg_ep-build
            -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/FixFfmpegPaths.cmake
    )
else()
    set(_ffmpeg_host_workarounds "")
    set(_ffmpeg_fix_paths "")
endif()

ExternalProject_Add(ffmpeg_ep
    SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/ffmpeg
    DOWNLOAD_COMMAND ""
    PREFIX ${CMAKE_BINARY_DIR}/ffmpeg-ep
    INSTALL_DIR ${FFMPEG_INSTALL}
    CONFIGURE_COMMAND ${FFMPEG_BASH} <SOURCE_DIR>/configure
        --prefix=<INSTALL_DIR>
        ${_ffmpeg_host_workarounds}
        --target-os=android --arch=${_ffmpeg_arch} ${_ffmpeg_cpu} --enable-cross-compile
        --cc=${_ffmpeg_tc}/${_ffmpeg_triple}${AIRPLAY_ANDROID_API}-clang
        --cxx=${_ffmpeg_tc}/${_ffmpeg_triple}${AIRPLAY_ANDROID_API}-clang++
        --ar=${_ffmpeg_tc}/llvm-ar --nm=${_ffmpeg_tc}/llvm-nm
        --ranlib=${_ffmpeg_tc}/llvm-ranlib --strip=${_ffmpeg_tc}/llvm-strip
        --sysroot=${CMAKE_SYSROOT}
        --enable-pic --disable-asm --disable-x86asm
        --disable-all --disable-debug --disable-network --disable-autodetect
        --enable-avcodec --enable-decoder=alac,aac --enable-static --disable-shared
        ${_ffmpeg_sanitize}
    ${_ffmpeg_fix_paths}
    BUILD_COMMAND ${FFMPEG_MAKE} -j${_ffmpeg_jobs}
    # Not `make install`: see cmake/InstallFFmpeg.sh for why.
    INSTALL_COMMAND ${FFMPEG_BASH} ${CMAKE_CURRENT_SOURCE_DIR}/cmake/InstallFFmpeg.sh
        <SOURCE_DIR> <BINARY_DIR> <INSTALL_DIR>
    BUILD_BYPRODUCTS ${FFMPEG_INSTALL}/lib/libavcodec.a ${FFMPEG_INSTALL}/lib/libavutil.a
    LOG_CONFIGURE TRUE
    LOG_BUILD TRUE
    LOG_INSTALL TRUE
)

file(MAKE_DIRECTORY ${FFMPEG_INSTALL}/include)

add_library(ffmpeg::avutil STATIC IMPORTED)
set_target_properties(ffmpeg::avutil PROPERTIES
    IMPORTED_LOCATION ${FFMPEG_INSTALL}/lib/libavutil.a
    INTERFACE_INCLUDE_DIRECTORIES ${FFMPEG_INSTALL}/include
)
add_library(ffmpeg::avcodec STATIC IMPORTED)
set_target_properties(ffmpeg::avcodec PROPERTIES
    IMPORTED_LOCATION ${FFMPEG_INSTALL}/lib/libavcodec.a
    INTERFACE_INCLUDE_DIRECTORIES ${FFMPEG_INSTALL}/include
    INTERFACE_LINK_LIBRARIES ffmpeg::avutil
)
