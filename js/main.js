(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll reveal
  var items = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && !reduced){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function(el){ io.observe(el); });
  } else {
    items.forEach(function(el){ el.classList.add('in'); });
  }

  // Counters
  var counters = document.querySelectorAll('.count');
  function animateCount(el){
    var target = parseInt(el.getAttribute('data-target'), 10);
    if(reduced){ el.textContent = target; return; }
    var start = null, dur = 1100;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if('IntersectionObserver' in window){
    var cio = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function(el){ cio.observe(el); });
  } else {
    counters.forEach(function(el){ el.textContent = el.getAttribute('data-target'); });
  }

  // Active nav link on scroll
  var navLinks = document.querySelectorAll('#primary-nav a');
  var sections = Array.prototype.slice.call(navLinks).map(function(a){
    return document.querySelector(a.getAttribute('href'));
  }).filter(Boolean);
  function onScroll(){
    var pos = window.scrollY + 120;
    var current = sections[0];
    sections.forEach(function(s){ if(s.offsetTop <= pos) current = s; });
    navLinks.forEach(function(a){
      a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
    });
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 3D flip cards (Work grid)
  var flipCards = document.querySelectorAll('.work-card');
  flipCards.forEach(function(card){
    var title = card.querySelector('h3');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-pressed', 'false');
    if(title){ card.setAttribute('aria-label', title.textContent + ', flip for details'); }

    function toggle(){
      var flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    }
    card.addEventListener('click', function(e){
      if(e.target.closest('a')) return;
      toggle();
    });
    card.addEventListener('keydown', function(e){
      if(e.target !== card) return;
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        toggle();
      }
    });
  });

  // Hero: 3D point-cloud (hand-rolled WebGL, no libraries) with 2D canvas fallback
  var canvas = document.getElementById('hero-canvas');
  var hero = document.querySelector('.hero');

  function hexToRgb01(hex){
    hex = (hex || '').trim();
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if(!m) return [0.69, 0.67, 1.0];
    return [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255];
  }
  function accentRGB(){ return hexToRgb01(getComputedStyle(document.documentElement).getPropertyValue('--accent')); }
  function lineRGB(){ return hexToRgb01('#8C6A48'); }

  var gl = null;
  try{ gl = canvas.getContext('webgl', { antialias: true, alpha: true }) || canvas.getContext('experimental-webgl'); }catch(e){ gl = null; }

  if(gl){
    initWebGLScene(gl);
  } else {
    init2DFallback();
  }

  function initWebGLScene(gl){
    var vsSrc =
      'attribute vec3 aPos;' +
      'uniform mat4 uMVP;' +
      'uniform float uPointBase;' +
      'varying float vDepth;' +
      'void main(){' +
      '  vec4 pos = uMVP * vec4(aPos, 1.0);' +
      '  gl_Position = pos;' +
      '  vDepth = pos.w;' +
      '  gl_PointSize = clamp(uPointBase / pos.w, 1.0, 9.0);' +
      '}';
    var vsLineSrc =
      'attribute vec3 aPos;' +
      'uniform mat4 uMVP;' +
      'varying float vDepth;' +
      'void main(){' +
      '  vec4 pos = uMVP * vec4(aPos, 1.0);' +
      '  gl_Position = pos;' +
      '  vDepth = pos.w;' +
      '}';
    var fsSrc =
      'precision mediump float;' +
      'varying float vDepth;' +
      'uniform vec3 uNear;' +
      'uniform vec3 uFar;' +
      'void main(){' +
      '  vec2 c = gl_PointCoord - vec2(0.5);' +
      '  float d = length(c);' +
      '  if(d > 0.5) discard;' +
      '  float alpha = smoothstep(0.5, 0.05, d);' +
      '  float t = clamp((vDepth - 5.5) / 6.0, 0.0, 1.0);' +
      '  vec3 col = mix(uNear, uFar, t);' +
      '  gl_FragColor = vec4(col, alpha * 0.9);' +
      '}';
    var fsLineSrc =
      'precision mediump float;' +
      'varying float vDepth;' +
      'uniform vec3 uFar;' +
      'void main(){' +
      '  float t = clamp((vDepth - 5.5) / 6.0, 0.0, 1.0);' +
      '  gl_FragColor = vec4(uFar, (1.0 - t) * 0.28);' +
      '}';

    function compile(src, type){
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    }
    function program(vsSource, fsSource){
      var vs = compile(vsSource, gl.VERTEX_SHADER);
      var fs = compile(fsSource, gl.FRAGMENT_SHADER);
      var p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      return p;
    }
    var pointProg = program(vsSrc, fsSrc);
    var lineProg = program(vsLineSrc, fsLineSrc);

    function m4id(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
    function m4mul(a,b){
      var o = new Float32Array(16);
      for(var i=0;i<4;i++) for(var j=0;j<4;j++){
        var s=0; for(var k=0;k<4;k++) s += a[k*4+j]*b[i*4+k];
        o[i*4+j]=s;
      }
      return o;
    }
    function m4perspective(fovy, aspect, near, far){
      var f = 1/Math.tan(fovy/2), nf = 1/(near-far);
      return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
    }
    function m4rotY(r){ var c=Math.cos(r),s=Math.sin(r); var m=m4id(); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
    function m4rotX(r){ var c=Math.cos(r),s=Math.sin(r); var m=m4id(); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
    function m4translate(x,y,z){ var m=m4id(); m[12]=x;m[13]=y;m[14]=z; return m; }

    var N = 170;
    var positions = new Float32Array(N * 3);
    for(var i = 0; i < N; i++){
      var x = (Math.random() - 0.5) * 7.5;
      var y = (Math.random() - 0.5) * 5.5;
      var z = 0.55 * x - 0.35 * y + (Math.random() - 0.5) * 2.6;
      positions[i*3] = x; positions[i*3+1] = y; positions[i*3+2] = z;
    }
    var edgePos = [];
    var maxEdges = 130, edgeCount = 0;
    for(var a = 0; a < N && edgeCount < maxEdges; a++){
      for(var b = a + 1; b < N && edgeCount < maxEdges; b++){
        var dx = positions[a*3]-positions[b*3], dy = positions[a*3+1]-positions[b*3+1], dz = positions[a*3+2]-positions[b*3+2];
        var dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(dist < 1.15){
          edgePos.push(positions[a*3],positions[a*3+1],positions[a*3+2], positions[b*3],positions[b*3+1],positions[b*3+2]);
          edgeCount++;
        }
      }
    }
    var edgeArray = new Float32Array(edgePos);

    var gridPos = [];
    var gridSize = 6, step = 1.5, gy = -2.7;
    for(var g = -gridSize; g <= gridSize; g += step){
      gridPos.push(g, gy, -gridSize,  g, gy, gridSize);
      gridPos.push(-gridSize, gy, g,  gridSize, gy, g);
    }
    var gridArray = new Float32Array(gridPos);

    var pointBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    var lineBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, edgeArray, gl.STATIC_DRAW);

    var gridBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.bufferData(gl.ARRAY_BUFFER, gridArray, gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    var W, H;
    function resize(){
      var DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = Math.max(1, W * DPR); canvas.height = Math.max(1, H * DPR);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    var rotY = 0.5, rotX = 0.18;
    var targetParX = 0, targetParY = 0, parX = 0, parY = 0;
    hero.addEventListener('pointermove', function(e){
      var r = hero.getBoundingClientRect();
      targetParX = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      targetParY = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
    });

    function frame(){
      if(!reduced){
        rotY += 0.0018;
        rotX = 0.18 + Math.sin(Date.now() * 0.00015) * 0.08;
        parX += (targetParX - parX) * 0.04;
        parY += (targetParY - parY) * 0.04;
      }
      var model = m4mul(m4rotY(rotY + parX), m4rotX(rotX + parY));
      var view = m4translate(0, 0, -9.5);
      var proj = m4perspective(0.62, W / H, 1, 30);
      var mvp = m4mul(proj, m4mul(view, model));

      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      var nearC = accentRGB(), farC = lineRGB();

      gl.useProgram(lineProg);
      var aPosG = gl.getAttribLocation(lineProg, 'aPos');
      gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
      gl.enableVertexAttribArray(aPosG);
      gl.vertexAttribPointer(aPosG, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(lineProg, 'uMVP'), false, mvp);
      gl.uniform3fv(gl.getUniformLocation(lineProg, 'uFar'), farC);
      gl.drawArrays(gl.LINES, 0, gridArray.length / 3);

      if(edgeArray.length){
        gl.useProgram(lineProg);
        var aPosL = gl.getAttribLocation(lineProg, 'aPos');
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
        gl.enableVertexAttribArray(aPosL);
        gl.vertexAttribPointer(aPosL, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(gl.getUniformLocation(lineProg, 'uMVP'), false, mvp);
        gl.uniform3fv(gl.getUniformLocation(lineProg, 'uFar'), nearC);
        gl.drawArrays(gl.LINES, 0, edgeArray.length / 3);
      }

      gl.useProgram(pointProg);
      var aPos = gl.getAttribLocation(pointProg, 'aPos');
      gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(pointProg, 'uMVP'), false, mvp);
      gl.uniform1f(gl.getUniformLocation(pointProg, 'uPointBase'), 26.0);
      gl.uniform3fv(gl.getUniformLocation(pointProg, 'uNear'), nearC);
      gl.uniform3fv(gl.getUniformLocation(pointProg, 'uFar'), farC);
      gl.drawArrays(gl.POINTS, 0, N);

      if(!reduced && heroVisible){ requestAnimationFrame(frame); }
    }

    var heroVisible = true;
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          var wasHidden = !heroVisible;
          heroVisible = e.isIntersecting;
          if(heroVisible && wasHidden && !reduced){ requestAnimationFrame(frame); }
        });
      }, { threshold: 0.01 }).observe(hero);
    }

    resize();
    frame();
    window.addEventListener('resize', resize);
  }

  function init2DFallback(){
    var ctx = canvas.getContext('2d');
    var dots = [], W, H, DPR;
    function resize(){
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var count = Math.max(24, Math.min(60, Math.round((W * H) / 26000)));
      dots = [];
      for(var i = 0; i < count; i++){
        dots.push({ x: Math.random()*W, y: Math.random()*H, vx: (Math.random()-0.5)*0.12, vy: (Math.random()-0.5)*0.12, r: 1 + Math.random()*1.6 });
      }
    }
    function draw(){
      ctx.clearRect(0, 0, W, H);
      var ac = 'rgb(' + accentRGB().map(function(v){return Math.round(v*255);}).join(',') + ')';
      var lc = 'rgb(' + lineRGB().map(function(v){return Math.round(v*255);}).join(',') + ')';
      for(var i = 0; i < dots.length; i++){
        var d = dots[i];
        if(!reduced){ d.x += d.vx; d.y += d.vy; if(d.x<0||d.x>W) d.vx*=-1; if(d.y<0||d.y>H) d.vy*=-1; }
        for(var j = i+1; j < dots.length; j++){
          var o = dots[j], dx = d.x-o.x, dy = d.y-o.y, dist = Math.sqrt(dx*dx+dy*dy);
          if(dist < 130){ ctx.strokeStyle = lc; ctx.globalAlpha = (1-dist/130)*0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(o.x,o.y); ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;
      for(var k = 0; k < dots.length; k++){
        var p = dots[k];
        ctx.fillStyle = k % 5 === 0 ? ac : lc;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      }
      if(!reduced){ requestAnimationFrame(draw); }
    }
    resize(); draw();
    window.addEventListener('resize', resize);
  }

  // 3D tilt interaction for cards (perspective follows pointer, disabled under reduced-motion)
  if(!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches){
    var tiltEls = document.querySelectorAll('.work-card, .about-card, .focus-card');
    var TRACK = 'transform .08s linear, box-shadow .3s ease, border-color .3s ease';
    var SETTLE = 'transform .6s cubic-bezier(0.22, 1.6, 0.36, 1), box-shadow .3s ease, border-color .3s ease';
    tiltEls.forEach(function(el){
      el.style.transition = SETTLE;
      el.style.transformStyle = 'preserve-3d';
      el.addEventListener('mouseenter', function(){ el.style.transition = TRACK; });
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        var rx = (0.5 - py) * 8, ry = (px - 0.5) * 8;
        el.style.transform = 'perspective(700px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-5px) translateZ(10px)';
      });
      el.addEventListener('mouseleave', function(){
        el.style.transition = SETTLE;
        el.style.transform = '';
      });
    });
  }
})();
