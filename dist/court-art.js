(function () {
  'use strict';

  function seed(value) {
    let bits = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
    bits = Math.imul(bits ^ bits >>> 13, 0xc2b2ae35);
    return ((bits ^ bits >>> 16) >>> 0) / 4294967296;
  }

  function fill(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function polygon(ctx, points, color) {
    ctx.beginPath();
    for (const [index, point] of points.entries()) {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function stroke(ctx, a, b, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function oval(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function gradient(ctx, x1, y1, x2, y2, stops) {
    const result = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [offset, color] of stops) result.addColorStop(offset, color);
    return result;
  }

  let grain;
  function surfaceGrain(ctx, width, height, opacity) {
    if (!grain) {
      grain = document.createElement('canvas');
      grain.width = grain.height = 144;
      const tile = grain.getContext('2d');
      for (let i = 0; i < 2200; i++) {
        const x = seed(i) * 144, y = seed(i * 31) * 144;
        fill(tile, i % 2 ? '#fbf1d9' : '#101b1a', x, y, 1, 1);
      }
    }
    ctx.save();
    ctx.globalAlpha *= opacity;
    fill(ctx, ctx.createPattern(grain, 'repeat'), 0, 0, width, height);
    ctx.restore();
  }

  function upperWall(ctx, {width, palette, tone, compact, wallArt}, base) {
    if (wallArt?.naturalWidth) {
      const scale = Math.max(width / wallArt.naturalWidth, base / wallArt.naturalHeight);
      const cropWidth = width / scale;
      const cropHeight = base / scale;
      const x = (wallArt.naturalWidth - cropWidth) * .53;
      const y = (wallArt.naturalHeight - cropHeight) * .47;
      ctx.drawImage(wallArt, x, y, cropWidth, cropHeight, 0, 0, width, base);
      const shade = gradient(ctx, 0, 0, 0, base, [
        [0, palette.roof + '9c'], [.42, palette.roof + '61'], [.82, palette.roof + '71'], [1, palette.roof + 'c4'],
      ]);
      fill(ctx, shade, 0, 0, width, base);
      return;
    }

    const wallLight = tone(palette.wall, .065);
    fill(ctx, gradient(ctx, 0, 0, 0, base, [[0, palette.roof], [.54, wallLight], [1, palette.wall]]), 0, 0, width, base);

    // Painted steel members sit above the dark balcony opening.
    for (let i = -1; i <= 6; i++) {
      const x = width * i / 5;
      const end = width / 2 + (x - width / 2) * .81;
      stroke(ctx, {x, y:base * .24}, {x:end, y:base}, palette.roof + 'cc', 7);
      stroke(ctx, {x:x + 2, y:base * .24}, {x:end + 2, y:base}, palette.paint + '15', 1);
    }
    fill(ctx, tone(palette.roof, -.16), 0, base * .38, width, 5);
    fill(ctx, palette.paint + '20', 0, base * .38 + 5, width, 1);

    for (const fraction of compact ? [.52, .84] : [.19, .51, .83]) {
      const x = width * fraction;
      const y = base * .47 + Math.abs(fraction - .5) * 8;
      const length = width * .107;
      stroke(ctx, {x:x - length * .37, y:base * .38}, {x:x - length * .37, y}, palette.roof, 1.2);
      stroke(ctx, {x:x + length * .37, y:base * .38}, {x:x + length * .37, y}, palette.roof, 1.2);
      fill(ctx, palette.roof, x - length / 2 - 2, y - 1, length + 4, 6);
      fill(ctx, tone(palette.paint, -.13), x - length / 2, y, length, 3.2);
      fill(ctx, palette.paint, x - length / 2 + 1, y + 3.2, length - 2, 1.2);
    }

  }

  function mezzanine(ctx, view) {
    const {width, floor, palette, tone, compact} = view;
    const stand = Math.min(compact ? 67 : 79, floor * .48);
    const base = floor - stand;
    upperWall(ctx, view, base);
    fill(ctx, tone(palette.roof, -.19), 0, base, width, stand);
    const rowHeight = stand * .32;
    const gap = Math.max(14, width / (compact ? 24 : 37));
    const shirts = [tone(palette.opponent, -.57), tone(palette.wood, -.45), tone(palette.wall, .18), tone(palette.paint, -.64), tone(palette.out, -.52)];
    const skin = ['#a88b73', '#8d7360', '#b29b81', '#715b4d'];

    for (let row = 0; row < 2; row++) {
      const y = base + rowHeight * (row + .95);
      fill(ctx, tone(palette.wall, row ? -.12 : -.22), 0, y - rowHeight * .68, width, rowHeight * .82);
      for (let i = -1; i < Math.ceil(width / gap); i++) {
        const index = row * 89 + i * 3 + 13;
        const space = seed(index);
        const x = gap * (i + .62 + row * .36 + (space - .5) * .27);
        if (i % 10 === 6 || space < .39) continue;
        const height = rowHeight * (.43 + seed(index + 3) * .21);
        const bulk = height * (.31 + seed(index + 6) * .14);
        const headY = y - height + (space - .5) * rowHeight * .12;
        const lean = (seed(index + 2) - .5) * bulk * .65;
        const top = headY + height * .24;
        const shirt = shirts[Math.floor(seed(index+1) * shirts.length)];
        const face = skin[Math.floor(seed(index+7)*skin.length)];
        oval(ctx, x, y + 1, bulk * 1.3, 1.8, palette.roof);
        ctx.beginPath();
        ctx.moveTo(x - bulk, y);
        ctx.quadraticCurveTo(x - bulk, top, x + lean, top);
        ctx.quadraticCurveTo(x + bulk * 1.04, top, x + bulk, y);
        ctx.fillStyle = shirt;
        ctx.fill();
        stroke(ctx, {x:x - bulk * .67, y:y - 2.6}, {x:x + bulk * .45,y:y - 1}, tone(shirt,.12), 1.25);
        oval(ctx, x + lean, headY, bulk * .48, height * .22, face);
        oval(ctx, x + lean - bulk * .07, headY - height * .11, bulk * .49, height * .12, palette.roof);
      }
      fill(ctx, palette.roof, 0, y, width, 3);
      stroke(ctx, {x:0, y:y + .5}, {x:width,y:y + .5}, palette.paint + '25');
    }

    const fascia = base + stand * .68;
    fill(ctx, gradient(ctx, 0, fascia, 0, floor, [[0, tone(palette.wood, -.63)], [1, tone(palette.wood, -.47)]]), 0, fascia, width, floor - fascia);
    for (let x = width * .09; x < width; x += width * .164) {
      stroke(ctx, {x,y:fascia}, {x,y:floor}, palette.roof + 'aa');
      stroke(ctx, {x:x+1,y:fascia + 1}, {x:x+1,y:floor}, palette.paint + '10');
    }
    fill(ctx, tone(palette.roof, -.15), 0, floor - 3, width, 3);
    fill(ctx, palette.paint + '20', 0, floor - 4, width, 1);
  }

  function timber(ctx, {width, height, floor, project, palette, tone}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floor, width, height - floor);
    ctx.clip();
    const p = (x, z) => project({x, z});
    fill(ctx, palette.wood, 0, floor, width, height - floor);
    const planks = Array.from({length:8}, (_, i) => tone(palette.wood, (i - 4) * .015));
    for (let i = -32; i <= 32; i++) {
      const x = i * .37;
      const end = x + .37;
      polygon(ctx, [p(x,-12),p(end,-12),p(end,11),p(x,11)], planks[Math.floor(seed(i + 96) * 8)]);
      stroke(ctx, p(x,-12), p(x,11), palette.roof + '26', .55);
      for (let board = 0; board < 11; board++) {
        const z = -12 + board * 2.27 + seed(i + 87) * 1.7;
        stroke(ctx, p(x,z), p(end,z), palette.roof + '30', .48);
        const fiber = x + .08 + seed(i * 17 + board) * .21;
        stroke(ctx, p(fiber,z+.09), p(fiber,z+.65+seed(i+board)*.9), palette.paint + '18', .43);
      }
    }
    const lightX = width * .53;
    const lightY = floor + (height - floor) * .27;
    const pool = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, width * .7);
    pool.addColorStop(0, palette.paint + '24');
    pool.addColorStop(.47, palette.wood + '00');
    pool.addColorStop(1, palette.roof + '65');
    fill(ctx, pool, 0, floor, width, height - floor);
    fill(ctx, gradient(ctx, 0, floor, 0, floor + 30, [[0,palette.roof + '68'],[1,palette.roof + '00']]), 0, floor, width, 30);
    surfaceGrain(ctx, width, height, .085);
    ctx.restore();
  }

  function mat(ctx, {width, height, project, palette, tone}, painted = false) {
    const quad = (x, z, y = 0) => [{x:-x,z,y}, {x,z,y}, {x,z:-z,y}, {x:-x,z:-z,y}].map(project);
    const edges = quad(3.26, 6.98);
    const far = Math.min(edges[0].y, edges[1].y);
    const near = Math.max(edges[2].y, edges[3].y);
    if (!painted) {
      polygon(ctx, quad(3.4, 7.11).map(p=>({x:p.x+1,y:p.y+3})), palette.roof + '54');
      polygon(ctx, quad(3.34, 7.07), tone(palette.court, -.4));
    }
    polygon(ctx, edges, gradient(ctx, 0, far, 0, near, [[0,tone(palette.court,-.18)],[.4,tone(palette.court,.1)],[.67,palette.court],[1,tone(palette.court,-.13)]]));
    ctx.save();
    polygon(ctx, edges);
    ctx.clip();
    if (painted) {
      for (let i = 0; i < 82; i++) {
        const x = (seed(i*5+81)-.5)*6.5, z = (seed(i*7+32)-.5)*13.9;
        const start = project({x,z}), end = project({x:x+.025+seed(i*3+5)*.09,z:z+.12});
        stroke(ctx, start, end, i%3===0 ? palette.roof+'16' : palette.paint+'13', .65);
      }
    } else {
      for (const seam of [-2.03, 0, 2.03]) {
        stroke(ctx, project({x:seam,z:6.98}), project({x:seam,z:-6.98}), palette.roof+'23', .55);
      }
    }
    surfaceGrain(ctx, width, height, .09);
    ctx.restore();
  }

  function windowLight(ctx, {width, height, floor, project, palette}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floor, width, height - floor);
    ctx.clip();
    const wash = gradient(ctx, width * .76, floor, width * .31, height, [
      [0, palette.paint + '24'], [.48, palette.paint + '1c'], [1, palette.paint + '00'],
    ]);
    for (const x of [2.05, 3.37, 4.69]) {
      polygon(ctx, [
        {x, z:6.95}, {x:x + 1.12, z:6.95},
        {x:x - 3.8, z:-3.9}, {x:x - 4.92, z:-3.9},
      ].map(project), wash);
    }
    ctx.restore();
  }

  function drawVenue(ctx, view) {
    mezzanine(ctx, view);
    timber(ctx, view);
    mat(ctx, view);
    if (view.wallArt?.naturalWidth) windowLight(ctx, view);
  }

  function outdoorBackdrop(ctx, {width, floor, palette, tone, outdoorArt}) {
    if (outdoorArt?.naturalWidth) {
      const scale = Math.max(width / outdoorArt.naturalWidth, floor / outdoorArt.naturalHeight);
      const cropWidth = width / scale, cropHeight = floor / scale;
      const x = (outdoorArt.naturalWidth - cropWidth) / 2;
      const y = outdoorArt.naturalHeight - cropHeight;
      ctx.drawImage(outdoorArt, x, y, cropWidth, cropHeight, 0, 0, width, floor);
      fill(ctx, gradient(ctx, 0, 0, 0, floor, [
        [0, palette.roof + '14'], [.55, palette.roof + '16'], [1, palette.roof + '35']
      ]), 0, 0, width, floor);
      return;
    }

    const sky = tone(palette.opponent, .28), haze = tone(palette.paint, -.05);
    fill(ctx, gradient(ctx, 0, 0, 0, floor, [[0, sky], [.82, haze]]), 0, 0, width, floor);
    for (const [x, y, span] of [[.19, .28, .19], [.66, .19, .24], [.91, .42, .14]]) {
      oval(ctx, x * width, y * floor, span * width, floor * .027, palette.paint + '79');
      oval(ctx, (x - span * .34) * width, (y + .02) * floor, span * width * .66, floor * .018, palette.paint + '53');
    }
    const ridge = [[0,.72],[.12,.56],[.24,.66],[.36,.57],[.51,.71],[.66,.52],[.76,.61],[.89,.51],[1,.63],[1,1],[0,1]];
    polygon(ctx, ridge.map(([x,y])=>({x:x*width,y:y*floor})), tone(palette.court,.37));
    fill(ctx, tone(palette.court,-.06), 0, floor*.92, width, floor*.08);
    for (let i = 0; i <= 32; i++) {
      const x = width * i / 32, size = floor * (.08 + seed(i + 44) * .16);
      const y = floor * (.9 - seed(i + 51) * .07);
      oval(ctx,x,y+size*.35,size*.65,size*.55,tone(palette.court,-.16+seed(i+13)*.23));
      oval(ctx,x-size*.22,y,size*.45,size*.52,tone(palette.court,-.07+seed(i+23)*.19));
    }
    const fenceTop = floor - Math.min(44,floor*.24), fence = tone(palette.roof,.31);
    fill(ctx, palette.roof + '23', 0, fenceTop, width, floor - fenceTop);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, fenceTop, width, floor - fenceTop);
    ctx.clip();
    for (let x = -48; x <= width + 48; x += 10) {
      for (const direction of [-1,1]) {
        stroke(ctx,{x,y:fenceTop},{x:x+(floor-fenceTop)*direction,y:floor},fence+'5e',.65);
      }
    }
    ctx.restore();
    for (let x = 0; x < width; x += width/8) stroke(ctx,{x,y:fenceTop-3},{x,y:floor},fence,1.8);
    stroke(ctx,{x:0,y:fenceTop},{x:width,y:fenceTop},fence,1.5);
  }

  function outdoorGroundDetail(ctx, {project, palette}) {
    for (let i = 0; i < 110; i++) {
      const side=i%2?1:-1, x=side*(3.32+seed(i*5+511)*7), z=(seed(i*13+23)-.5)*15;
      const start=project({x,z}), end=project({x:x+.035+seed(i*3+7)*.12,z:z+.05});
      stroke(ctx,start,end,i%3===0?palette.roof+'21':palette.paint+'1f',.75);
    }

    // Project the branches and gaps in the foliage onto the paving.
    for (const [index,{x,z,reach}] of [
      {x:-6.9,z:-2.5,reach:2.8},
      {x:6.2,z:3.0,reach:2.35},
      {x:8.5,z:-5.4,reach:2.25},
    ].entries()) {
      const side=Math.sign(x), root=project({x:x+side*2.5,z:z+.34});
      const fork=project({x:x+side*.36,z:z-.16});
      polygon(ctx,[
        {x:root.x,y:root.y+root.s*.055},
        {x:root.x,y:root.y-root.s*.055},
        {x:fork.x,y:fork.y-fork.s*.014},
        {x:fork.x,y:fork.y+fork.s*.014}
      ],palette.roof+'20');
      const inner=project({x:x-side*reach,z}), edge=project({x:x+side*reach,z});
      ctx.fillStyle=gradient(ctx,edge.x,edge.y,inner.x,inner.y,[
        [0,palette.roof+'36'],[.55,palette.roof+'28'],[1,palette.roof+'0c']
      ]);
      ctx.beginPath();
      const boughs=[[-.82,-.62],[-.51,.48],[-.33,-1.16],[.13,.77],[.32,-.76],[.69,.34],[.79,-.43]];
      for (const [branch,[dx,dz]] of boughs.entries()) {
        for (let i=0;i<30;i++) {
          const key=index*251+branch*31+i, angle=seed(key*23+6)*Math.PI*2;
          const distance=.82*Math.sqrt(seed(key*11+83));
          const px=x+dx*reach*side+Math.cos(angle)*distance;
          const pz=z+dz+Math.sin(angle)*distance;
          const size=.07+seed(key*7+90)*.26;
          const center=project({x:px,z:pz}), front=project({x:px,z:pz-size*1.4});
          const rx=center.s*size, ry=Math.max(.6,Math.abs(front.y-center.y));
          ctx.moveTo(center.x+rx,center.y);
          ctx.ellipse(center.x,center.y,rx,ry,0,0,Math.PI*2);
        }
      }
      ctx.fill();
    }
  }

  function drawOutdoorVenue(ctx, view) {
    const {width, height, floor, project, palette, tone} = view;
    outdoorBackdrop(ctx, view);
    const paving = '#a79a88';
    fill(ctx, gradient(ctx, 0, floor, 0, height, [
      [0, tone(paving, -.12)], [.35, paving], [1, tone(paving, -.35)]
    ]), 0, floor, width, height-floor);
    fill(ctx, gradient(ctx, 0, floor, 0, floor + 14, [
      [0, palette.roof + '35'], [1, palette.roof + '00']
    ]), 0, floor, width, 14);
    for (const z of [-7.4, -3.7, 0, 3.7, 7.4]) {
      const a=project({x:-14,z}),b=project({x:14,z});
      if(a.y>floor)stroke(ctx,a,b,palette.roof+'1e',.7);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floor, width, height - floor);
    ctx.clip();
    outdoorGroundDetail(ctx,view);
    surfaceGrain(ctx, width, height, .065);
    ctx.restore();
    mat(ctx, view, true);
  }

  function drawWindFlags(ctx, project, palette, wind, time) {
    const z = 3.55;
    for (const x of [-3.74,3.74]) {
      const foot=project({x,z}), top=project({x,y:2.45,z});
      const scale=top.s, length=Math.sign(wind)*(.44+.45*Math.abs(wind))*scale;
      const wave=Math.sin(time*7+x*.7)*scale*.045;
      const mid={x:top.x+length*.53,y:top.y+scale*.027+wave*.4};
      const tip={x:top.x+length,y:top.y+scale*.095+wave};
      oval(ctx,foot.x+3,foot.y+1,scale*.14,scale*.036,palette.roof+'66');
      stroke(ctx,foot,top,palette.roof,2.1);
      stroke(ctx,{x:foot.x+.65,y:foot.y},{x:top.x+.65,y:top.y},palette.paint+'86',.75);
      polygon(ctx,[top,mid,tip,{x:mid.x,y:mid.y+scale*.145},{x:top.x,y:top.y+scale*.21}],palette.player);
      stroke(ctx,mid,{x:mid.x,y:mid.y+scale*.145},palette.roof+'58',.8);
    }
  }

  function drawTape(ctx, corners, palette, tone, scale = 1) {
    const [left, right, upperRight, upperLeft] = corners;
    polygon(ctx, corners, palette.roof + '47');
    const between = (a, b, t) => ({x:a.x + (b.x-a.x)*t, y:a.y + (b.y-a.y)*t});
    for (let i = 0; i <= 44; i++) {
      stroke(ctx, between(left, right, i/44), between(upperLeft, upperRight, i/44), palette.paint + '41', .5 * scale);
    }
    for (let i = 1; i < 13; i++) {
      stroke(ctx, between(upperLeft, left, i/13), between(upperRight, right, i/13), palette.paint + '41', .5 * scale);
    }
    stroke(ctx, left, right, palette.roof + 'bf', 1.1 * scale);
    for (const [foot, top] of [[left,upperLeft],[right,upperRight]]) {
      oval(ctx, foot.x+2*scale, foot.y+1.5*scale, 9*scale, 2.2*scale, palette.roof + '64');
      stroke(ctx, {x:foot.x-5*scale,y:foot.y}, {x:foot.x+7*scale,y:foot.y}, palette.roof, 2.8 * scale);
      stroke(ctx, foot, top, tone(palette.opponent,-.59), 3.8 * scale);
      stroke(ctx, {x:foot.x+.8*scale,y:foot.y-2}, {x:top.x+.8*scale,y:top.y}, palette.opponent + '7f', .8 * scale);
    }
    stroke(ctx, upperLeft, upperRight, tone(palette.paint,-.33), 3.5 * scale);
    stroke(ctx, {x:upperLeft.x,y:upperLeft.y-.65*scale}, {x:upperRight.x,y:upperRight.y-.65*scale}, palette.paint, 2.2 * scale);
  }

  window.ShuttleCourtArt = {drawVenue, drawOutdoorVenue, drawWindFlags, drawTape, gradient, surfaceGrain};
})();
