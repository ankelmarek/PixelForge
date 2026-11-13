"""Original CC0 technical world. Deterministic tiles, chunk JSON, no dependencies."""
import json, math, random
from pathlib import Path
from pixel_art import Image
out = Path(__file__).resolve().parents[1] / 'public/assets/demos/large-world'
(out/'chunks').mkdir(parents=True, exist_ok=True)
def save(name, image): image.save(out/f'{name}.png')
rng=random.Random(713)
grass='#718d58'; dark='#426952'; light='#9eae69'; ink='#273f42'
# Shared 16px atlas. Variants, road, water, banks, and transparent vegetation tiles.
atlas=Image(16*16,16)
for frame in range(16):
    im=Image(16,16)
    if frame<4:
        im.rect(0,0,16,16,grass)
        for i in range(7):
            x,y=rng.randrange(15),rng.randrange(15)
            im.rect(x,y,2,1,('#7e9860','#6b8655','#8da367')[i%3])
    elif frame in [4,5,6]:
        im.rect(0,0,16,16,('#b7ab83','#a99b79','#c2b38a')[frame-4])
        for i in range(6): im.rect(rng.randrange(16),rng.randrange(16),2,1,'#a79977')
        if frame==5: im.rect(0,0,16,2,'#829062')
        if frame==6: im.rect(0,14,16,2,'#829062')
    elif frame==7:
        im.rect(0,0,16,16,'#5a8990'); im.rect(2,5,6,1,'#79a3a0'); im.rect(11,12,4,1,'#79a3a0')
    elif frame==8:
        im.rect(0,0,16,16,'#a2aa77'); im.rect(1,3,12,7,'#92a473')
    elif frame in [9,10,11]:
        im.rect(7,8,2,8,'#655e48'); im.circle(8,8,7,dark); im.circle(7,6,6,'#4e7852'); im.circle(6,4,4,'#668955')
        im.rect(3,4,4,2,'#829c60'); im.rect(11,8,3,3,'#365e4e')
        if frame==10: im.rect(4,9,2,2,'#d7ae64')
    elif frame==12:
        im.rect(6,7,1,8,dark); im.rect(10,10,1,5,dark); im.rect(4,6,4,2,'#edcf88'); im.rect(9,9,3,2,'#dd9d7b')
    elif frame==13:
        im.rect(3,10,11,4,'#536e5d'); im.rect(4,7,8,6,'#829488'); im.rect(6,6,6,3,'#a5aea0')
    elif frame==14:
        im.rect(2,7,12,5,'#665c4c'); im.rect(2,6,12,2,'#b1a17a'); im.rect(4,5,2,10,'#c5b58a'); im.rect(11,5,2,10,'#c5b58a')
    else:
        im.rect(7,3,2,12,'#506e50'); im.rect(5,5,2,2,'#95aa6b'); im.rect(9,8,2,2,'#95aa6b')
    atlas.blit(im,frame*16,0)
save('tiles',atlas)
# People, utility cart, and small buildings use a coherent 3/4 view.
worker=Image(64,24)
for frame in range(4):
    im=Image(16,24)
    im.rect(4,18,3,5,ink); im.rect(9,18+(frame==1),3,4,ink)
    im.rect(3,11,10,8,'#d6b779'); im.rect(6,12,5,7,'#cd8559')
    im.rect(5,4,7,7,'#edcda1'); im.rect(11,7,1,2,ink)
    im.rect(3,4,11,3,'#e7d19a'); im.rect(5,2,7,3,'#a5b884')
    im.rect(2,13,2,5-(frame==3)*3,'#edcda1'); im.rect(12,13,2,4,'#edcda1')
    worker.blit(im,frame*16,0)
save('worker',worker)
vehicle=Image(96,32)
for frame in range(2):
    im=Image(48,32)
    im.rect(6,24,9,7,ink); im.rect(33,24,8,7,ink)
    im.rect(4,12,29,15,'#b2a376'); im.rect(6,10,25,3,'#d2c493'); im.rect(7,14,22,9,'#8c815f')
    im.rect(30,8,13,19,'#cc8b58'); im.rect(32,7,9,4,'#edbd77'); im.rect(33,12,9,7,'#7ca9aa')
    im.rect(43,21,3,5,'#d9c798'); im.rect(4,27,39,2,'#46615b'); im.rect(9+frame,26,3,3,'#a0aaa0'); im.rect(35-frame,26,3,3,'#a0aaa0')
    vehicle.blit(im,frame*48,0)
save('vehicle',vehicle)
def building(width,height,roof,frames=1):
    sheet=Image(width*frames,height)
    for frame in range(frames):
        im=Image(width,height); im.rect(2,height-5,width-3,5,'#4b6b52')
        im.rect(4,16,width-8,height-20,'#c4b18a'); im.rect(width-13,16,9,height-20,'#a29270')
        im.rect(1,12,width-2,9,roof); im.rect(5,6,width-10,8,roof); im.rect(10,2,width-20,8,roof)
        im.rect(6,8,width-12,2,'#c5976b'); im.rect(3,18,width-6,2,'#5d6353')
        im.rect(width//2-5,height-19,10,15,'#455b55'); im.rect(width//2-3,height-17,6,12,'#7a8470')
        im.rect(7,25,7,7,'#7fa4a0'); im.rect(7,25,7,1,'#d7c99d')
        if frames>1:
            im.rect(width-16,22,8,8,'#4c655c'); im.rect(width-14,24,4,4,'#e2c073' if frame else '#9bab77')
        sheet.blit(im,frame*width,0)
    return sheet
save('depot',building(48,48,'#a97856'))
save('processor',building(64,48,'#637e80',2))
save('storage',building(32,48,'#8e795d'))
source=Image(48,16)
for x in [0,16,32]: source.rect(x+1,3,13,11,'#a17c53'); source.rect(x+2,3,11,2,'#d4b079'); source.rect(x+3,6,9,6,'#69824f'); source.rect(x+5,7,5,3,'#cbbc76')
save('source',source)
cargo=Image(8,8); cargo.rect(0,1,8,7,'#9f794f'); cargo.rect(0,1,8,2,'#dfc48c'); cargo.rect(3,1,2,7,'#c8a46c'); save('cargo',cargo)
cover=Image(320,180,'#718d58')
for y in range(0,180,16):
    for x in range(0,320,16):
        for yy in range(16):
            for xx in range(16):
                if x+xx<320 and y+yy<180: cover.pixels[(y+yy)*320+x+xx]=atlas.pixels[yy*atlas.w+xx]
cover.rect(0,102,320,35,'#b7ab83'); cover.blit(building(64,48,'#637e80'),180,55); save('cover',cover)
# World metadata stays resident; sector files contain only presentation layers.
# Terrain is computed in absolute cells, so roads/water continue at every seam.
def terrain(x,y):
    if 30<=y<35 or 34<=x<39: return 5 if y==30 else 6 if y==34 and not 34<=x<39 else 4
    lake = (x-105)**2/300 + (y-70)**2/160
    if lake<1: return 7
    if lake<1.25: return 8
    return ((x*13+y*7) ^ (x*y))%4

def runs(values):
    result=[]
    for v in values:
        if result and result[-1][0]==v: result[-1][1]+=1
        else: result.append([v,1])
    return result
for sy in range(16):
    for sx in range(16):
        ground=[]; decoration=[]
        for ly in range(32):
            for lx in range(32):
                x,y=sx*32+lx,sy*32+ly
                ground.append(terrain(x,y)); value=-1
                h=(x*73856093 ^ y*19349663) & 0xffffffff
                if terrain(x,y)<4 and not (25<x<47 and 20<y<35) and not (67<x<80 and 24<y<35):
                    if h%83==0: value=9+(h//83)%3
                    elif h%51==0: value=12
                    elif h%173==0: value=13
                    elif h%39==0: value=15
                decoration.append(value)
        (out/'chunks'/f'{sx}-{sy}.json').write_text(json.dumps({'schemaVersion':1,'id':f's-{sx}-{sy}','revision':'terrain-1','layers':[{'name':'ground','runs':runs(ground)},{'name':'details','runs':runs(decoration)}]},separators=(',',':'))+'\n')
for cells in [256,512]:
    nodes=[
      dict(id='source',kind='source',x=42,y=24,width=3,height=1,texture='source',access={'x':43,'y':26},stock={'raw':24},harvestResource='raw',harvestSeconds=.4,workPoints=[{'x':43,'y':26}]),
      dict(id='remote-source',kind='source',x=cells-12,y=cells-14,width=3,height=1,texture='source',access={'x':cells-11,'y':cells-12},stock={'raw':24},harvestResource='raw',harvestSeconds=.4,workPoints=[{'x':cells-11,'y':cells-12}]),
      dict(id='depot',kind='depot',x=27,y=27,width=3,height=2,texture='depot',access={'x':29,'y':32},stock={}),
      dict(id='processor',kind='processor',x=69,y=26,width=4,height=3,texture='processor',access={'x':71,'y':32},stock={},recipe={'input':'raw','output':'product','inputAmount':2,'outputAmount':2,'seconds':.5,'destination':'storage'}),
      dict(id='storage',kind='storage',x=76,y=26,width=2,height=3,texture='storage',access={'x':77,'y':30},stock={},capacity=48),
    ]
    actors=[dict(id=id,kind=kind,x=x,y=y,texture=kind,capacity=capacity,speed=8,depot='depot',loadSeconds=.1,unloadSeconds=.1,cargoTexture='cargo') for id,kind,x,y,capacity in [('worker-1','worker',35,24,4),('worker-2','worker',38,25,4),('vehicle','vehicle',36,32,12)]]
    # Water collision uses conservative rectangles inside the illustrated pond.
    blockers=[{'x':x,'y':y,'width':1,'height':1} for y in range(57,83) for x in range(87,123) if terrain(x,y)==7]
    merged=[]
    for y in range(57,83):
        xs=[r['x'] for r in blockers if r['y']==y]
        if xs: merged.append({'x':min(xs),'y':y,'width':max(xs)-min(xs)+1,'height':1})
    world=dict(schemaVersion=2,id=f'world-{cells*16}',title=f'Atlas {cells*16}',width=cells,height=cells,tileSize=16,
      roads=[{'x':0,'y':30,'width':cells,'height':5},{'x':34,'y':0,'width':5,'height':cells}],blockers=merged,
      resources=[{'id':'raw','unitValue':1,'icon':'cargo'},{'id':'product','unitValue':1,'icon':'cargo'}],nodes=nodes,actors=actors,
      goal={'storage':'storage','resource':'product','amount':48},camera={'zoom':1,'minZoom':.5,'maxZoom':2,'center':{'x':35,'y':27}},
      terrain={'revision':'terrain-1','sectorSize':32,'texture':'tiles','frames':16,'fallbackColor':0x718d58,'cacheSectors':24,
        'sectors':[{'id':f's-{x}-{y}','x':x,'y':y,'url':f'chunks/{x}-{y}.json'} for y in range(cells//32) for x in range(cells//32)]})
    (out/f'world-{cells*16}.json').write_text(json.dumps(world,separators=(',',':'))+'\n')
print('Generated two worlds, 256 sectors and 9 small PNGs.')
