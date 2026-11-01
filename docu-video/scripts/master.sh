#!/bin/bash
# Masterizado final: limitador de picos a ≈ −1 dBFS sin recomprimir el video.
# Uso: scripts/master.sh out/video.mp4   (reemplaza el archivo y conserva una copia .premaster.mp4)
set -euo pipefail
in="$1"
pre="${in%.mp4}.premaster.mp4"
mv "$in" "$pre"
ffmpeg -v error -y -i "$pre" -c:v copy -af "alimiter=limit=0.89:attack=5:release=50:level=false" -c:a aac -b:a 256k "$in"
rm "$pre"
ffmpeg -hide_banner -i "$in" -vn -af volumedetect -f null - 2>&1 | grep -E "max_volume"
