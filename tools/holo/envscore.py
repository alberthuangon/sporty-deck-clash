"""Worst case across the whole --holo-x / --holo-y surface, per rarity.

   Kit pixels are found in the foil-OFF frame by colour, then the SAME pixels
   are read in all 25 on-frames. Reported against the live rule: hue angle to
   --home (355.6) and --away (215.4) must be at least 15 degrees, or dE2000 at
   least 15. The worst frame is the one that decides, not the one a screenshot
   happened to catch."""
import sys, json, colorsys, math, os
exec(open(sys.argv[0].rsplit('/',1)[0] + '/foildiff.py').read().split("on_p, off_p")[0])
D = sys.argv[1]
meta=json.load(open(os.path.join(D,'env.json'))); grid=json.load(open(os.path.join(D,'grid.json')))
sc=meta['scale']
w,h,c2,B=read_png(os.path.join(D,'env-off.png'))
KIT=(0x4F,0x17,0x20); TOL=34
HOME, AWAY = 355.6, 215.4
def arc(a,b):
    d=abs(a-b)%360
    return min(d,360-d)

sel={}
for card in meta['cards']:
    x0=int(card['x']*sc); y0=int(card['y']*sc)
    x1=x0+int(card['w']*sc); y1=y0+int(card['h']*sc)
    px=[]
    for y in range(y0,y1):
        rb=y*w*c2
        for x in range(x0,x1):
            pb=rb+x*c2
            if abs(B[pb]-KIT[0])<=TOL and abs(B[pb+1]-KIT[1])<=TOL and abs(B[pb+2]-KIT[2])<=TOL:
                px.append((y,x))
    sel[card['rarity']]=px
print("kit pixels found:", {k:len(v) for k,v in sel.items()})

worst={k:None for k in sel}
for g in grid:
    _,_,c1,A=read_png(os.path.join(D,g['name']))
    for rar,px in sel.items():
        if not px: continue
        s=[0,0,0]
        for (y,x) in px:
            pa=y*w*c1+x*c1
            for k in range(3): s[k]+=A[pa+k]
        m=[v/len(px)/255 for v in s]
        hue=colorsys.rgb_to_hsv(*m)[0]*360
        margin=min(arc(hue,HOME), arc(hue,AWAY))
        if worst[rar] is None or margin<worst[rar][0]:
            worst[rar]=(margin,hue,g['gx'],g['gy'],'#%02X%02X%02X'%tuple(round(v*255) for v in m))
print(f"\n{'rarity':8} {'worst hue margin':>17} {'at hue':>8} {'at holo-x/y':>13}  colour   rule: >= 15 deg or dE00 >= 15")
for rar,v in worst.items():
    mg,hue,gx,gy,hexv=v
    print(f"{rar:8} {mg:17.1f}° {hue:7.1f}° {str(gx)+'% / '+str(gy)+'%':>13}  {hexv}  {'OK' if mg>=15 else 'NEEDS dE00'}")
