import sys
import av

src, dst = sys.argv[1], sys.argv[2]
inp = av.open(src)
out = av.open(dst, 'w')
stream = out.add_stream('pcm_s16le', rate=44100)
stream.layout = 'mono' if len(inp.streams.audio[0].layout.channels) == 1 else 'stereo'
for frame in inp.decode(audio=0):
    for packet in stream.encode(frame):
        out.mux(packet)
for packet in stream.encode(None):
    out.mux(packet)
out.close()
inp.close()
print(dst)
