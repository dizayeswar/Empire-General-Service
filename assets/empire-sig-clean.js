/* Turn a phone photo of a handwritten signature into a clean e-signature stamp:
   transparent background, blue ink, cropped to the pen lines.
   Each spot is compared with the paper around it, so shadows, grey paper and
   uneven light are removed instead of becoming blue blocks. */
(function () {
  var INK = [16, 38, 125];
  var MAX_W = 900;
  var MAX_H = 360;

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* Paper brightness around each pixel: bright percentile per block, smoothed. */
  function paperLevel(lum, w, h) {
    var cell = Math.max(12, Math.round(Math.max(w, h) / 24));
    var gx = Math.ceil(w / cell);
    var gy = Math.ceil(h / cell);
    var grid = new Float32Array(gx * gy);
    var hist = new Uint32Array(256);
    for (var by = 0; by < gy; by++) {
      for (var bx = 0; bx < gx; bx++) {
        hist.fill(0);
        var n = 0;
        var y1 = Math.min(h, (by + 1) * cell);
        var x1 = Math.min(w, (bx + 1) * cell);
        for (var y = by * cell; y < y1; y++) {
          for (var x = bx * cell; x < x1; x++) { hist[lum[y * w + x] | 0]++; n++; }
        }
        var want = n * 0.1;
        var seen = 0;
        var v = 255;
        for (; v > 0; v--) { seen += hist[v]; if (seen >= want) break; }
        grid[by * gx + bx] = v;
      }
    }
    /* Blocks full of ink (thick pen) read too dark: lift them toward their neighbours. */
    var lifted = new Float32Array(grid.length);
    for (var j = 0; j < gy; j++) {
      for (var i = 0; i < gx; i++) {
        var best = grid[j * gx + i];
        for (var dj = -1; dj <= 1; dj++) {
          for (var di = -1; di <= 1; di++) {
            var a = i + di, b = j + dj;
            if (a < 0 || b < 0 || a >= gx || b >= gy) continue;
            if (grid[b * gx + a] > best) best = grid[b * gx + a];
          }
        }
        lifted[j * gx + i] = best;
      }
    }
    var out = new Float32Array(w * h);
    for (var y2 = 0; y2 < h; y2++) {
      var fy = Math.max(0, Math.min(gy - 1, (y2 + 0.5) / cell - 0.5));
      var y0i = Math.floor(fy), y1i = Math.min(gy - 1, y0i + 1), ty = fy - y0i;
      for (var x2 = 0; x2 < w; x2++) {
        var fx = Math.max(0, Math.min(gx - 1, (x2 + 0.5) / cell - 0.5));
        var x0i = Math.floor(fx), x1i = Math.min(gx - 1, x0i + 1), tx = fx - x0i;
        var top = lifted[y0i * gx + x0i] * (1 - tx) + lifted[y0i * gx + x1i] * tx;
        var bot = lifted[y1i * gx + x0i] * (1 - tx) + lifted[y1i * gx + x1i] * tx;
        out[y2 * w + x2] = top * (1 - ty) + bot * ty;
      }
    }
    return out;
  }

  function clean(img) {
    var w0 = img.naturalWidth || img.width;
    var h0 = img.naturalHeight || img.height;
    var scale = Math.min(1, MAX_W / w0, MAX_H / h0);
    var w = Math.max(1, Math.round(w0 * scale));
    var h = Math.max(1, Math.round(h0 * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h);
    var d = data.data;
    var total = w * h;
    var lum = new Float32Array(total);
    for (var p = 0; p < total; p++) {
      lum[p] = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
    }
    var paper = paperLevel(lum, w, h);

    /* How much darker than the paper around it: 0 = paper, 1 = full ink. */
    var ink = new Float32Array(total);
    for (var q = 0; q < total; q++) {
      var bg = Math.max(40, paper[q]);
      var drop = (bg - lum[q]) / bg;
      ink[q] = clamp01((drop - 0.12) / 0.28);
    }

    /* Keep pen strokes only: drop specks and big dark areas (desk, shadow, frame). */
    var label = new Int32Array(total).fill(-1);
    var keep = new Uint8Array(total);
    var stack = new Int32Array(total);
    var minArea = Math.max(6, Math.round(total * 0.00004));
    var maxFill = 0.06;
    var GROW = 0.2; /* faint pen joins a stroke that is clearly ink somewhere */
    for (var s = 0; s < total; s++) {
      if (label[s] !== -1 || ink[s] < GROW) continue;
      var sp = 0, area = 0, peak = 0, minX = w, minY = h, maxX = 0, maxY = 0;
      stack[sp++] = s;
      label[s] = s;
      var members = [];
      while (sp) {
        var cur = stack[--sp];
        members.push(cur);
        area++;
        if (ink[cur] > peak) peak = ink[cur];
        var cx = cur % w, cy = (cur - cx) / w;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (var k = 0; k < 8; k++) {
          var nx = cx + (k === 0 || k === 3 || k === 5 ? -1 : (k === 2 || k === 4 || k === 7 ? 1 : 0));
          var ny = cy + (k < 3 ? -1 : (k > 4 ? 1 : 0));
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var ni = ny * w + nx;
          if (label[ni] !== -1 || ink[ni] < GROW) continue;
          label[ni] = s;
          stack[sp++] = ni;
        }
      }
      var boxArea = (maxX - minX + 1) * (maxY - minY + 1);
      var solid = area / boxArea;
      var tooBig = area > total * maxFill;
      var blob = boxArea > total * 0.02 && solid > 0.45;
      if (area >= minArea && peak >= 0.5 && !tooBig && !blob) {
        for (var m = 0; m < members.length; m++) keep[members[m]] = 1;
      }
    }

    /* Grow the kept strokes by 1px so their soft edges stay. */
    var near = new Uint8Array(total);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (!keep[y * w + x]) continue;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1;
          }
        }
      }
    }

    var bx0 = w, by0 = h, bx1 = -1, by1 = -1;
    for (var r = 0; r < total; r++) {
      var o = r * 4;
      var a = near[r] ? ink[r] : 0;
      if (a < 0.08) { d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0; continue; }
      d[o] = INK[0]; d[o + 1] = INK[1]; d[o + 2] = INK[2];
      d[o + 3] = Math.round(Math.pow(a, 0.8) * 255);
      var px = r % w, py = (r - px) / w;
      if (px < bx0) bx0 = px;
      if (px > bx1) bx1 = px;
      if (py < by0) by0 = py;
      if (py > by1) by1 = py;
    }
    ctx.putImageData(data, 0, 0);
    if (bx1 < 0) return '';
    var pad = 4;
    bx0 = Math.max(0, bx0 - pad); by0 = Math.max(0, by0 - pad);
    bx1 = Math.min(w - 1, bx1 + pad); by1 = Math.min(h - 1, by1 + pad);
    var out = document.createElement('canvas');
    out.width = bx1 - bx0 + 1;
    out.height = by1 - by0 + 1;
    out.getContext('2d').drawImage(canvas, bx0, by0, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  /* cb(url) gets the clean stamp, or '' when no pen lines were found. */
  window.empireCleanSignature = function (dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var url = '';
      try { url = clean(img); } catch (err) { url = ''; }
      cb(url);
    };
    img.onerror = function () { cb(''); };
    img.src = dataUrl;
  };
})();
