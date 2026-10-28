import sys, json, colorsys
sys.path.insert(0, sys.argv[0].rsplit('/',1)[0])
exec(open(sys.argv[0].rsplit('/',1)[0] + '/foildiff.py').read().split("on_p, off_p")[0])

on_p, off_p, meta_p = sys.argv[1], sys.argv[2], sys.argv[3]
meta=json.load(open(meta_p)); sc=meta['scale']
w,h,c1,A=read_png(on_p); _,_,c2,B=read_png(off_p)

# The window is FOUND, not guessed: the kit is #4F1720, so select the pixels
# that ARE that colour in the foil-off frame and measure only those.
KIT=(0x4F,0x17,0x20); TOL=34
print(f"{'rarity':8} {'kit px':>8} {'mean |dRGB|':>12} {'hue before':>11} {'hue after':>10} {'sat before':>11} {'sat after':>10}")
for card in meta['cards']:
    x0=int(card['x']*sc); y0=int(card['y']*sc)
    x1=x0+int(card['w']*sc); y1=y0+int(card['h']*sc)
    n=0; tot=0.0; sb=[0,0,0]; sa=[0,0,0]
    for y in range(y0,y1):
        rb=y*w*c2; ra=y*w*c1
        for x in range(x0,x1):
            pb=rb+x*c2
            if abs(B[pb]-KIT[0])>TOL or abs(B[pb+1]-KIT[1])>TOL or abs(B[pb+2]-KIT[2])>TOL: continue
            pa=ra+x*c1
            n+=1
            tot+=(abs(A[pa]-B[pb])+abs(A[pa+1]-B[pb+1])+abs(A[pa+2]-B[pb+2]))/3.0
            for k in range(3): sb[k]+=B[pb+k]; sa[k]+=A[pa+k]
    if not n: print(f"{card['rarity']:8} {0:>8}  (kit not found)"); continue
    mb=[v/n/255 for v in sb]; ma=[v/n/255 for v in sa]
    hb,_,vb=colorsys.rgb_to_hsv(*mb); ha,_,va=colorsys.rgb_to_hsv(*ma)
    _,ssb,_=colorsys.rgb_to_hsv(*mb); _,ssa,_=colorsys.rgb_to_hsv(*ma)
    hexf=lambda m:'#%02X%02X%02X'%tuple(min(255,max(0,round(v*255))) for v in m)
    print(f"{card['rarity']:8} {n:>8} {tot/n:12.2f} {hb*360:10.1f}° {ha*360:9.1f}° {ssb:11.2f} {ssa:10.2f}  {hexf(mb)} -> {hexf(ma)}")
