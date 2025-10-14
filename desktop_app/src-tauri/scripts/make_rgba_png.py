#!/usr/bin/env python3
import sys, struct, zlib, binascii

def chunk(t: bytes, data: bytes) -> bytes:
    return struct.pack('>I', len(data)) + t + data + struct.pack('>I', binascii.crc32(t + data) & 0xffffffff)

def write_rgba_png(path: str, width: int, height: int, rgba=(255, 0, 255, 255)) -> None:
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    row = bytes(rgba) * width
    raw = b''.join([b"\x00" + row for _ in range(height)])
    idat = zlib.compress(raw, 9)
    with open(path, 'wb') as f:
        f.write(sig)
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', idat))
        f.write(chunk(b'IEND', b''))

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("usage: make_rgba_png.py <path> <width> <height>")
        sys.exit(2)
    write_rgba_png(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]))


