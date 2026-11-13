"""PixelForge U0: reproducible full packages and bounded, read-only validation.

Python 3.11+ standard library only. ZIP metadata uses zipfile; bounded inflation and CRC use zlib. The structural
preflight restricts input to the documented non-ZIP64, single-disk ZIP subset.
No extraction, execution, network access, or installation is performed.
"""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import struct
import sys
import tempfile
import zipfile
import zlib

UPDATER_VERSION = "1.0.0"
ENGINE_SCHEMA_VERSION = 2
DEFAULT_LIMITS = {
    "maxArchiveBytes": 64 * 1024 * 1024,
    "maxFiles": 4096,  # Includes manifest.json.
    "maxFileBytes": 16 * 1024 * 1024,
    "maxTotalBytes": 256 * 1024 * 1024,
    "maxManifestBytes": 2 * 1024 * 1024,
    "maxMetadataBytes": 4 * 1024 * 1024,
    "maxCompressionRatio": 200,
}
STATIC_EXTENSIONS = {
    ".js",
    ".css",
    ".json",
    ".png",
    ".webp",
    ".svg",
    ".jpg",
    ".jpeg",
    ".ogg",
    ".mp3",
    ".wav",
    ".woff",
    ".woff2",
}
FORBIDDEN = {"admin-updater", "storage", "backups", "node_modules", "src"}
SERVER_EXTENSIONS = {
    "php",
    "phtml",
    "phar",
    "cgi",
    "pl",
    "py",
    "sh",
    "exe",
    "dll",
    "bat",
    "cmd",
    "asp",
    "aspx",
    "jsp",
    "shtml",
    "htaccess",
    "ini",
    "env",
    "config",
}


class PackageError(ValueError):
    pass


def require(condition, code):
    if not condition:
        raise PackageError(code)


def limits_from(overrides=None):
    result = DEFAULT_LIMITS | (overrides or {})
    require(result.keys() == DEFAULT_LIMITS.keys(), "LIMIT_CONFIG: unknown key")
    require(
        all(type(v) is int and v > 0 for v in result.values()),
        "LIMIT_CONFIG: positive integers required",
    )
    return result


def version(value):
    require(
        isinstance(value, str)
        and re.fullmatch(
            r"(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})", value
        ),
        "VERSION: expected stable MAJOR.MINOR.PATCH",
    )
    return tuple(map(int, value.split(".")))


def static_path(path, manifest=False):
    require(isinstance(path, str) and 0 < len(path) <= 240, "PATH: invalid length")
    parts = path.split("/")
    require(
        len(parts) <= 16
        and all(
            re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*", p) and not p.endswith(".")
            for p in parts
        ),
        "PATH: noncanonical name",
    )
    for part in parts:
        name = part.lower()
        require(
            name not in FORBIDDEN
            and not re.fullmatch(
                r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", name
            ),
            "PATH: reserved name",
        )
        require(not set(name.split(".")[1:]) & SERVER_EXTENSIONS, "PATH: server file")
    require(
        (manifest and path == "manifest.json")
        or path == "index.html"
        or (
            len(parts) > 1
            and parts[0] == "assets"
            and (
                Path(path).suffix.lower() in STATIC_EXTENSIONS
                or parts[-1] == "LICENSE.md"
            )
        ),
        "ALLOWLIST: static build files only",
    )
    return path.lower()


def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        require(key not in obj, "JSON: duplicate key")
        obj[key] = value
    return obj


def parse_json(data):
    try:
        return json.loads(
            data,
            object_pairs_hook=unique_object,
            parse_constant=lambda _: (_ for _ in ()).throw(
                PackageError("JSON: invalid number")
            ),
        )
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise PackageError(f"JSON: invalid document ({type(exc).__name__})") from exc


def manifest_files(data, limits, expected_version=None):
    require(
        type(data) is dict
        and data.keys()
        == {
            "formatVersion",
            "project",
            "packageType",
            "releaseVersion",
            "baseVersion",
            "requiredUpdaterVersion",
            "engineSchemaVersion",
            "files",
            "deletions",
        },
        "MANIFEST: incorrect fields",
    )
    require(
        type(data["formatVersion"]) is int and data["formatVersion"] == 1,
        "FORMAT: unsupported version",
    )
    require(data["project"] == "pixelforge", "PROJECT: mismatch")
    require(
        data["packageType"] == "full"
        and data["baseVersion"] is None
        and data["deletions"] == [],
        "TYPE: only full packages supported in U0",
    )
    version(data["releaseVersion"])
    require(
        expected_version is None or data["releaseVersion"] == expected_version,
        "VERSION: release mismatch",
    )
    require(
        version(data["requiredUpdaterVersion"]) <= version(UPDATER_VERSION),
        "VERSION: newer updater required",
    )
    require(
        type(data["engineSchemaVersion"]) is int
        and data["engineSchemaVersion"] == ENGINE_SCHEMA_VERSION,
        "SCHEMA: unsupported engine contract",
    )
    require(
        type(data["files"]) is list and 0 < len(data["files"]) < limits["maxFiles"],
        "MANIFEST: file count",
    )
    entries, normalized, total = {}, set(), 0
    for entry in data["files"]:
        require(
            type(entry) is dict and entry.keys() == {"path", "size", "sha256"},
            "MANIFEST: incorrect file fields",
        )
        key = static_path(entry["path"])
        require(key not in normalized, "DUPLICATE: manifest path")
        normalized.add(key)
        require(
            type(entry["size"]) is int and 0 <= entry["size"] <= limits["maxFileBytes"],
            "LIMIT: file size",
        )
        require(
            isinstance(entry["sha256"], str)
            and re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]),
            "MANIFEST: sha256",
        )
        total += entry["size"]
        entries[entry["path"]] = entry
    require(
        total <= limits["maxTotalBytes"]
        and "index.html" in entries
        and entries["index.html"]["size"] > 0,
        "MANIFEST: total size or missing index.html",
    )
    return entries


def preflight(raw, limits):
    """Bound metadata allocations and reject ambiguous/local-central ZIP layouts."""
    require(22 <= len(raw) <= limits["maxArchiveBytes"], "LIMIT: archive size")
    end = struct.unpack_from("<4s4H2IH", raw, len(raw) - 22)
    require(
        end[0] == b"PK\x05\x06"
        and end[1] == end[2] == end[7] == 0
        and end[3] == end[4],
        "ZIP: single disk, no comments, no trailing data required",
    )
    count, cd_size, cd_offset = end[4:7]
    require(0 < count <= limits["maxFiles"] and count < 65535, "LIMIT: ZIP entry count")
    require(
        cd_size <= limits["maxMetadataBytes"] and cd_offset + cd_size == len(raw) - 22,
        "ZIP: invalid central directory",
    )
    pos, local_end, total, names = cd_offset, 0, 0, set()
    for _ in range(count):
        require(pos + 46 <= len(raw) - 22, "ZIP: truncated central entry")
        c = struct.unpack_from("<4s6H3I5H2I", raw, pos)
        (
            sig,
            made,
            needed,
            flags,
            method,
            time,
            date,
            crc,
            compressed,
            size,
            nl,
            el,
            cl,
            disk,
            internal,
            external,
            offset,
        ) = c
        require(
            sig == b"PK\x01\x02"
            and needed <= 20
            and flags in (0, 0x800)
            and method in (0, 8)
            and el == cl == disk == 0,
            "ZIP: unsupported entry features",
        )
        require(
            0 < nl <= 240 and pos + 46 + nl <= len(raw) - 22, "ZIP: invalid name length"
        )
        name_bytes = raw[pos + 46 : pos + 46 + nl]
        try:
            name = name_bytes.decode("ascii")
        except UnicodeError as exc:
            raise PackageError("PATH: ASCII names required") from exc
        key = static_path(name, manifest=True)
        require(key not in names, "DUPLICATE: ZIP path")
        names.add(key)
        mode = external >> 16
        require(
            made >> 8 in (0, 3)
            and stat.S_IFMT(mode) in (0, stat.S_IFREG)
            and not mode & 0o7111
            and not external & 0xFFDE,
            "ZIP: regular non-executable files required",
        )
        require(
            size <= limits["maxFileBytes"]
            and size <= max(1, compressed) * limits["maxCompressionRatio"],
            "LIMIT: file size or compression ratio",
        )
        require(
            name != "manifest.json" or size <= limits["maxManifestBytes"],
            "LIMIT: manifest size",
        )
        total += size
        require(total <= limits["maxTotalBytes"], "LIMIT: total expanded size")
        require(
            offset == local_end and offset + 30 <= cd_offset,
            "ZIP: overlapping entries or unexpected prefix/gap",
        )
        h = struct.unpack_from("<4s5H3I2H", raw, offset)
        require(
            h
            == (
                b"PK\x03\x04",
                needed,
                flags,
                method,
                time,
                date,
                crc,
                compressed,
                size,
                nl,
                0,
            ),
            "ZIP: local header mismatch",
        )
        require(
            raw[offset + 30 : offset + 30 + nl] == name_bytes,
            "ZIP: local filename mismatch",
        )
        local_end = offset + 30 + nl + compressed
        require(local_end <= cd_offset, "ZIP: entry exceeds payload")
        pos += 46 + nl
    require(
        pos == cd_offset + cd_size and local_end == cd_offset,
        "ZIP: directory count/size mismatch",
    )


def decode_member(raw, info):
    """Check the real deflate end, including output hidden behind a false size."""
    start = info.header_offset + 30 + len(info.filename.encode("ascii"))
    stop = start + info.compress_size
    decoder = zlib.decompressobj(-15) if info.compress_type == 8 else None
    count, crc = 0, 0
    for offset in range(start, stop, 65536):
        pending = raw[offset : min(stop, offset + 65536)]
        while pending:
            if decoder:
                block = decoder.decompress(
                    pending, min(65536, info.file_size - count + 1)
                )
                pending = decoder.unconsumed_tail
                require(not decoder.unused_data, "ZIP: trailing compressed data")
            else:
                block, pending = pending, b""
            count += len(block)
            require(
                count <= info.file_size,
                "LIMIT: actual expanded size exceeds declaration",
            )
            crc = zlib.crc32(block, crc)
            yield block
    require(decoder is None or decoder.eof, "ZIP: incomplete deflate stream")
    require(count == info.file_size and crc == info.CRC, "ZIP: size or CRC mismatch")


def validate_bytes(raw, overrides=None, expected_version=None):
    limits = limits_from(overrides)
    preflight(raw, limits)
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            require(
                "manifest.json" in archive.namelist(), "MANIFEST: missing manifest.json"
            )
            manifest = parse_json(
                b"".join(decode_member(raw, archive.getinfo("manifest.json")))
            )
            entries = manifest_files(manifest, limits, expected_version)
            require(
                set(archive.namelist()) == set(entries) | {"manifest.json"},
                "MANIFEST: undeclared or missing file",
            )
            for path, entry in entries.items():
                require(
                    archive.getinfo(path).file_size == entry["size"],
                    "SIZE: manifest mismatch",
                )
                digest, count = hashlib.sha256(), 0
                for block in decode_member(raw, archive.getinfo(path)):
                    count += len(block)
                    require(count <= entry["size"], "LIMIT: actual expanded size")
                    digest.update(block)
                require(
                    count == entry["size"] and digest.hexdigest() == entry["sha256"],
                    "HASH: payload mismatch",
                )
            return {
                "valid": True,
                "releaseVersion": manifest["releaseVersion"],
                "packageType": "full",
                "engineSchemaVersion": manifest["engineSchemaVersion"],
                "files": len(entries),
                "expandedBytes": sum(e["size"] for e in entries.values()),
                "archiveBytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
            }
    except (zipfile.BadZipFile, RuntimeError, EOFError, zlib.error) as exc:
        raise PackageError(f"ZIP: corrupt payload ({type(exc).__name__})") from exc


def validate_file(path, overrides=None, expected_version=None):
    limits = limits_from(overrides)
    require(Path(path).is_file(), "ZIP: regular archive required")
    with Path(path).open("rb") as stream:
        require(
            stat.S_ISREG(os.fstat(stream.fileno()).st_mode),
            "ZIP: regular archive required",
        )
        require(
            os.fstat(stream.fileno()).st_size <= limits["maxArchiveBytes"],
            "LIMIT: archive size",
        )
        raw = stream.read(limits["maxArchiveBytes"] + 1)
    return validate_bytes(raw, limits, expected_version)


def package_release(source, destination, release_version, overrides=None):
    limits = limits_from(overrides)
    version(release_version)
    source, destination = Path(source), Path(destination)
    require(
        source.is_dir() and not source.is_symlink(),
        "SOURCE: regular build directory required",
    )
    payload, normalized, total = [], set(), 0
    for parent, dirs, files in os.walk(source, followlinks=False):
        for name in dirs:
            require(not (Path(parent) / name).is_symlink(), "SOURCE: symlink directory")
        for name in files:
            path = Path(parent) / name
            info = path.lstat()
            require(stat.S_ISREG(info.st_mode), "SOURCE: regular files only")
            relative = path.relative_to(source).as_posix()
            key = static_path(relative)
            require(key not in normalized, "DUPLICATE: source path")
            normalized.add(key)
            total += info.st_size
            require(
                info.st_size <= limits["maxFileBytes"]
                and total <= limits["maxTotalBytes"]
                and len(payload) + 2 <= limits["maxFiles"],
                "LIMIT: source build",
            )
            payload.append((relative, path))
    payload.sort()
    manifest = {
        "formatVersion": 1,
        "project": "pixelforge",
        "packageType": "full",
        "releaseVersion": release_version,
        "baseVersion": None,
        "requiredUpdaterVersion": UPDATER_VERSION,
        "engineSchemaVersion": ENGINE_SCHEMA_VERSION,
        "files": [],
        "deletions": [],
    }
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / f"pixelforge-{release_version}-full.zip"
    fd, temporary = tempfile.mkstemp(
        prefix=".pixelforge-", suffix=".zip", dir=destination
    )
    os.close(fd)
    try:
        with zipfile.ZipFile(temporary, "w", allowZip64=False) as archive:

            def write(path, data):
                info = zipfile.ZipInfo(path, (1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                compressor = zlib.compressobj(9, zlib.DEFLATED, -15)
                compressed_size = len(compressor.compress(data) + compressor.flush())
                info.compress_type = (
                    zipfile.ZIP_STORED
                    if len(data)
                    > max(1, compressed_size) * limits["maxCompressionRatio"]
                    else zipfile.ZIP_DEFLATED
                )
                archive.writestr(info, data, compresslevel=9)
                require(
                    archive.fp.tell() <= limits["maxArchiveBytes"],
                    "LIMIT: generated archive",
                )

            for relative, path in payload:
                with path.open("rb") as stream:
                    data = stream.read(limits["maxFileBytes"] + 1)
                require(
                    len(data) <= limits["maxFileBytes"],
                    "LIMIT: source changed during packaging",
                )
                manifest["files"].append(
                    {
                        "path": relative,
                        "size": len(data),
                        "sha256": hashlib.sha256(data).hexdigest(),
                    }
                )
                write(relative, data)
            manifest_files(manifest, limits)
            write(
                "manifest.json",
                (json.dumps(manifest, indent=2, ensure_ascii=True) + "\n").encode(),
            )
        result = validate_file(temporary, limits, release_version)
        checksum = target.with_suffix(".zip.sha256")
        checksum_data = f"{result['sha256']}  {target.name}\n".encode()
        # Refuse a different artifact with the same version; never silently replace it.
        for path, data in [
            (target, Path(temporary).read_bytes()),
            (checksum, checksum_data),
        ]:
            require(not path.is_symlink(), "OUTPUT: symlink destination")
            if path.exists():
                require(
                    path.is_file() and path.read_bytes() == data,
                    "OUTPUT: version already exists with different content",
                )
        if not target.exists():
            # Same-directory link publishes a complete file, failing if a peer won the race.
            os.link(temporary, target)
        if not checksum.exists():
            with checksum.open("xb") as stream:
                stream.write(checksum_data)
        return {**result, "archive": str(target), "checksum": str(checksum)}
    finally:
        Path(temporary).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    pack = commands.add_parser("pack", help="Package a completed static build")
    pack.add_argument("--source", default="dist")
    pack.add_argument("--output", default="downloads")
    pack.add_argument("--version")
    check = commands.add_parser(
        "validate", help="Read-only integrity and compatibility check"
    )
    check.add_argument("archive")
    check.add_argument("--expect-version")
    for command in (pack, check):
        command.add_argument(
            "--limits", help="Local JSON object overriding validation limits"
        )
    args = parser.parse_args()
    try:
        limits = parse_json(Path(args.limits).read_bytes()) if args.limits else None
        require(limits is None or type(limits) is dict, "LIMIT_CONFIG: object required")
        if args.command == "pack":
            release = (
                args.version or parse_json(Path("package.json").read_bytes())["version"]
            )
            result = package_release(args.source, args.output, release, limits)
        else:
            result = validate_file(args.archive, limits, args.expect_version)
        print(json.dumps(result, indent=2))
        return 0
    except (PackageError, OSError, KeyError) as exc:
        print(f"Package rejected: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
