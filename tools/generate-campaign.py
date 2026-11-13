"""Generate the authored three-map campaign (stdlib Python 3)."""
import json
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'public/assets/games/forest-demo/levels'
centers=[420,820,1220,1620,2020,2420,2820]
for index,(name,background,tint,decoration) in enumerate([
    ('clearing','background',0xffffff,'flowers'),
    ('marsh','dawn',0xead5ae,'ferns'),
    ('sanctuary','ruins',0xc8d6cd,'stones'),
]):
    platforms=[dict(x=0,y=156,width=3200,height=24)]
    entities=[dict(id='beacon',type='switch',x=160,y=156,texture='beacon',requires={'condition':'allCollected'},onInteract=[dict(action='toggleFlag',flag='activated')])]
    if index==0: platforms.append(dict(x=88,y=144,width=40,height=12))
    for i,c in enumerate(centers):
        high = (index == 1 and i in [2,5]) or (index == 2 and i in [1,3,5])
        if high:
            platforms += [dict(x=c-160,y=128,width=64,height=16),dict(x=c-84,y=100,width=64,height=16),dict(x=c-16,y=72,width=64,height=16)]
        else:
            platforms += [dict(x=c-120,y=128,width=80,height=16),dict(x=c-28,y=100,width=64,height=16)]
        entities.append(dict(id=f'shard-{i}',type='collectible',x=c,y=63 if high else 91,texture='gem'))
    for i,x in enumerate([600,1400,2200,2900]): entities.append(dict(id=f'checkpoint-{i}',type='checkpoint',x=x,y=156,texture='checkpoint'))
    enemy_centers=[[550],[550,1350],[550,1350,2150]][index]
    for i,x in enumerate(enemy_centers):
        entities.append(dict(id=f'sentry-{i}',type='enemy',x=x,y=156,texture='enemy',patrol=dict(min=x-12,max=x+14,speed=16+index*3)))
    for i,x in enumerate([[],[1000,1800],[1000,1800,2600]][index]):
        entities.append(dict(id=f'bramble-{i}',type='hazard',x=x,y=156,width=20,height=12,texture='hazard'))
    if index==2:
        platforms += [dict(x=2940,y=128,width=64,height=16),dict(x=3012,y=100,width=64,height=16),dict(x=3076,y=72,width=64,height=16)]
        entities.append(dict(id='heart',type='collectible',x=3100,y=63,texture='gem'))
    level=dict(schemaVersion=1,id=name,title=['Leśna polana','Mgliste mokradła','Stare sanktuarium'][index],width=3200,height=180,spawn=dict(x=28,y=139),platforms=platforms,interaction=dict(x=160,y=156,action='activate'),exit=dict(x=3152,y=156),entities=entities,exitRequires=dict(allFlags=['activated'],condition='allCollected'),theme=dict(background=background,tint=tint,decoration=decoration))
    (out/f'{name}.json').write_text(json.dumps(level,indent=2)+'\n')
