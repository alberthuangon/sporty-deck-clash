(async () => {
  const plan = __PLAN__
  const hero = document.querySelector('.phone .hero')
  const sheet = document.createElement('div')
  sheet.id = 'sheet'
  sheet.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;display:grid;' +
    'grid-template-columns:repeat(5,__W__px);gap:14px;padding:18px;background:#15181E'
  for (const p of plan) {
    const w = hero.cloneNode(true)
    w.style.width = '__W__px'
    w.style.setProperty('--holo-dx', '38%')
    w.style.setProperty('--holo-dy', '44%')
    w.style.animation = 'none'
    const cf = w.querySelector('.cf')
    cf.classList.remove('r-C', 'r-R', 'r-E', 'r-L')
    cf.classList.add('r-' + p.rarity)
    cf.style.width = '__W__px'
    const img = w.querySelector('img.pa')
    img.removeAttribute('loading'); img.src = p.url
    const nm = w.querySelector('.cf-name'); if (nm) nm.textContent = p.id + ' · ' + p.rarity
    sheet.appendChild(w)
  }
  document.body.appendChild(sheet)
  await Promise.all([...sheet.querySelectorAll('img')].map(i =>
    i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r })))
  const b = sheet.getBoundingClientRect()
  return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height })
})()
