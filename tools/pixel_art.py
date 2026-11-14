"""Small deterministic RGBA pixel-art canvas, no third-party dependencies."""
import math
import struct
import zlib
from pathlib import Path

class Image:
    def __init__(self,w,h,color=(0,0,0,0)):
        self.w,self.h=w,h
        self.pixels=[self.color(color)]*(w*h)
    def color(self,color):
        if isinstance(color,str): return tuple(bytes.fromhex(color.lstrip('#')))+(255,)
        return color
    def rect(self,x,y,w,h,color):
        color=self.color(color)
        for yy in range(max(0,int(y)),min(self.h,int(y+h))):
            for xx in range(max(0,int(x)),min(self.w,int(x+w))): self.pixels[yy*self.w+xx]=color
    def circle(self,x,y,r,color):
        for yy in range(int(y-r),int(y+r+1)):
            dx=int(math.sqrt(max(0,r*r-(yy-y)**2)))
            self.rect(x-dx,yy,2*dx+1,1,color)
    def blit(self,other,x,y):
        for yy in range(other.h):
            for xx in range(other.w):
                p=other.pixels[yy*other.w+xx]
                if p[3] and 0<=x+xx<self.w and 0<=y+yy<self.h: self.pixels[(y+yy)*self.w+x+xx]=p
    def save(self,path):
        def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
        data=b''.join(b'\0'+bytes(v for p in self.pixels[y*self.w:(y+1)*self.w] for v in p) for y in range(self.h))
        Path(path).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(data,9))+chunk(b'IEND',b''))
