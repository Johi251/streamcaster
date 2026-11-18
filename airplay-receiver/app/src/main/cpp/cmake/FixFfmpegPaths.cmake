# ffmpeg's configure runs under MSYS bash and therefore records paths in POSIX
# form ("/c/Users/..."). The NDK's make.exe is a native Windows binary and
# cannot resolve those, so the build dies with
#   Makefile:1: /c/Users/.../Makefile: No such file or directory
#
# Rewrite every MSYS drive path ("/<letter>/") to its Windows form ("<letter>:/")
# in the files configure generated. Only single-letter prefixes are touched, so
# ordinary POSIX paths such as /usr/bin stay intact.
#
# Note: the path cannot be passed in as -DMSYS=..., because CMake normalises
# absolute-looking command-line values on Windows (it rewrites "/c/x" to "C:/x").
#
# Required: -DWORKDIR=<external project build dir>

if(NOT WORKDIR)
    message(FATAL_ERROR "FixFfmpegPaths: WORKDIR is required")
endif()

foreach(_f "ffbuild/config.mak" "Makefile")
    set(_p "${WORKDIR}/${_f}")
    if(EXISTS "${_p}")
        file(READ "${_p}" _content)
        string(REGEX REPLACE "(^|[^A-Za-z0-9_])/([A-Za-z])/" "\\1\\2:/" _content "${_content}")
        file(WRITE "${_p}" "${_content}")
        message(STATUS "FixFfmpegPaths: rewrote ${_f}")
    endif()
endforeach()
