"""Synthetic renderer fixtures only. Not product artwork. Python 3 stdlib."""
from pathlib import Path
from pixel_art import Image
out=Path(__file__).resolve().parents[1]/'tests/fixtures/assets/test'
out.mkdir(parents=True,exist_ok=True)
for key,w,h,frames,color in [
 ('background',640,416,1,'#27444c'),('player',16,24,4,'#b6cf84'),
 ('terrain',16,16,1,'#84976a'),('beacon',16,24,1,'#e8c76b'),('portal',16,32,1,'#86bbc6'),
 ('worker',16,24,4,'#b6cf84'),('vehicle',48,32,2,'#e8c76b'),
 ('source',64,16,1,'#84976a'),('depot',32,32,1,'#b5966c'),
 ('processor',64,48,2,'#86bbc6'),('storage',32,48,1,'#a9bac0'),
 ('cargo',8,8,1,'#e8c76b'),('fill',16,32,1,'#b6cf84')]:
 image=Image(w*frames,h)
 for i in range(frames):
  image.rect(i*w,0,w,h,color)
  image.rect(i*w+2,2,max(1,w-4),2,'#e9eddf')
  image.rect(i*w+2+i%2,h-4,max(1,w-4),2,'#425e63')
 image.save(out/f'{key}.png')
