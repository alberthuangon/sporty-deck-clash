import zlib, struct, sys, json, colorsys

def read_png(path):
    d = open(path,'rb').read(); assert d[:8]==b'\x89PNG\r\n\x1a\n'
    i=8; idat=b''; w=h=bd=ct=None
    while i < len(d):
        ln=struct.unpack('>I',d[i:i+4])[0]; typ=d[i+4:i+8]; body=d[i+8:i+8+ln]; i+=12+ln
        if typ==b'IHDR': w,h,bd,ct=struct.unpack('>IIBB',body[:10])
        elif typ==b'IDAT': idat+=body
        elif typ==b'IEND': break
    assert bd==8 and ct in (2,6), (bd,ct)
    ch = 3 if ct==2 else 4
    raw=zlib.decompress(idat); stride=w*ch; out=bytearray(w*h*ch); prev=bytearray(stride); p=0
    for y in range(h):
        f=raw[p]; p+=1; line=bytearray(raw[p:p+stride]); p+=stride
        for x in range(stride):
            a=line[x-ch] if x>=ch else 0; b=prev[x]; c=prev[x-ch] if x>=ch else 0
            if f==1: line[x]=(line[x]+a)&255
            elif f==2: line[x]=(line[x]+b)&255
            elif f==3: line[x]=(line[x]+(a+b)//2)&255
            elif f==4:
                pp=a+b-c; pa=abs(pp-a); pb=abs(pp-b); pc=abs(pp-c)
                pr=a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        out[y*stride:(y+1)*stride]=line; prev=line
    return w,h,ch,out

on_p, off_p, meta_p = sys.argv[1], sys.argv[2], sys.argv[3]
meta=json.load(open(meta_p)); sc=meta['scale']
w1,h1,c1,A=read_png(on_p); w2,h2,c2,B=read_png(off_p)
assert (w1,h1)==(w2,h2), (w1,h1,w2,h2)
print(f"frames {w1}x{h1}  on-ch {c1} off-ch {c2}")
print(f"{'rarity':8} {'mean |dRGB|':>12} {'coverage>12':>12} {'coverage>40':>12} {'hue spread':>11}")
rows=[]
for card in meta['cards']:
    x0=int(card['x']*sc); y0=int(card['y']*sc)
    x1=x0+int(card['w']*sc); y1=y0+int(card['h']*sc)
    tot=0.0; n=0; c12=0; c40=0; hues=[0]*36
    for y in range(y0,y1):
        ra=y*w1*c1; rb=y*w1*c2
        for x in range(x0,x1):
            pa=ra+x*c1; pb=rb+x*c2
            dr=A[pa]-B[pb]; dg=A[pa+1]-B[pb+1]; db=A[pa+2]-B[pb+2]
            m=(abs(dr)+abs(dg)+abs(db))/3.0
            tot+=m; n+=1
            if m>12:
                c12+=1
                hu=colorsys.rgb_to_hsv(abs(dr)/255,abs(dg)/255,abs(db)/255)[0]
                hues[int(hu*36)%36]+=1
            if m>40: c40+=1
    live=sum(1 for b in hues if b>c12*0.01) if c12 else 0
    cov=c12/n
    # Hue spread is counted over the pixels the foil actually moved, so when
    # it moves almost none the figure is noise wearing a number. Common on a
    # real illustration covers 2% of the card and read .528 -- HIGHER than
    # Rare -- from a few hundred stray pixels. Below a twentieth of the card
    # there is nothing to describe, so it says so instead of inventing it.
    spread = live/36 if cov >= 0.05 else None
    rows.append((card['rarity'], tot/n, cov, c40/n, spread))
    txt = f"{spread:11.3f}" if spread is not None else f"{'  too sparse':>11}"
    print(f"{card['rarity']:8} {tot/n:12.2f} {cov:12.3f} {c40/n:12.3f} {txt}")
