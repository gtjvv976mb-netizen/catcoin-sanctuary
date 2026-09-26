# enc.sh NAME -> clip-NAME.mp4 (1280x720 H.264, 30 fps from 12 fps frames, silent)
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2
$FF -y -hide_banner -loglevel error -framerate 12 -i frames/$1/%04d.jpg ${2:+-t $2} -vf "scale=1280:720,fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 21 -profile:v high -movflags +faststart -an out/clip-$1.mp4
ls -la out/clip-$1.mp4
