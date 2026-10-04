(() => {
  const beats = [...document.querySelectorAll('.story-beat')];
  const poses = [...document.querySelectorAll('[data-pose-image]')];
  const muralFrames = [...document.querySelectorAll('[data-mural-frame]')];
  const sceneMuralCamera = document.querySelector('#scene-mural-camera');
  const sceneMuralWall = document.querySelector('#scene-mural-wall');
  const wallTiles = [...document.querySelectorAll('[data-wall-tile]')];
  const waterRipple = document.querySelector('#scene-water-ripple');
  const waterSurface = document.querySelector('.scene-water-ripple__surface');
  const waterSurfaceImage = document.querySelector('#river-current-surface');
  const waterNoise = document.querySelector('#river-current-noise');
  const waterDisplacement = document.querySelector('#river-current-displacement');
  const story = document.querySelector('#story-start');
  const scene = document.querySelector('.scene-sticky');
  const ending = document.querySelector('#ending');
  const muralAspectRatio = 6496 / 1114;
  const flightOverlay = document.querySelector('#flight-overlay');
  const activeCount = document.querySelector('#active-count');
  const panelCaption = document.querySelector('#panel-caption');
  const unityFrame = document.querySelector('#apsara-unity-frame');
  const unityRenderCanvas = document.querySelector('#apsara-flight-canvas');
  const unityRenderContext = unityRenderCanvas?.getContext('2d', { alpha: true });
  const backRibbonSvg = document.querySelector('#flight-ribbons-back');
  const frontRibbonSvg = document.querySelector('#flight-ribbons-front');
  const veilSvg = document.querySelector('#flight-veil');
  const veilLeftGroup = document.querySelector('#veil-left-group');
  const veilRightGroup = document.querySelector('#veil-right-group');
  let lastViewBox = '';
  const captions = ['河水中的救助', '王后的梦与悬赏', '猎队逼近鹿王', '鹿王向国王陈情'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarseMobile = window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches;
  const narrowScreen = window.matchMedia('(max-width: 760px)').matches;
  const constrainedMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
  const saveData = navigator.connection?.saveData === true;
  const slowConnection = ['slow-2g', '2g'].includes(navigator.connection?.effectiveType);
  const useLightweightFlight = coarseMobile || narrowScreen || constrainedMemory || saveData || slowConnection || reduceMotion;
  if (scene && useLightweightFlight) scene.classList.add('is-lightweight');

  let currentBeat = -1;
  let targetProgress = 0;
  let renderedProgress = 0;
  let targetFlightProgress = 0;
  let renderedFlightProgress = 0;
  let timelineFrame = 0;
  let lastFrameTime = 0;
  let lastUnitySentAt = 0;
  let lastUnityProgress = -1;
  let unityCopyFrame = 0;
  let unityLoadStarted = false;
  let unityReady = false;
  let unityChosen = false;
  let wallLoadStarted = false;
  let torchFrame = 0;
  const targetTorch = { x: 61, y: 43 };
  const renderedTorch = { x: 61, y: 43 };
  const wallPanelCenters = [.13, .377, .623, .869];
  const cameraStops = beats.map((beat) => wallPanelCenters[Number(beat.dataset.panel)] ?? .5);
  const cameraZooms = [1.12, 1.16, 1.1, 1.18];
  const ribbonMotion = {
    lastAt: 0,
    lastViewBox: '',
    delta: 1 / 60,
    points: new Map()
  };

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const easeInOut = (value) => value * value * (3 - 2 * value);
  const smoothstep = (start, end, value) => easeInOut(clamp((value - start) / (end - start)));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const fmt = (value) => Number(value.toFixed(1));

  function maybeLoadUnity(progress) {
    if (useLightweightFlight || unityLoadStarted || !unityFrame || progress < .06) return;
    const source = unityFrame.dataset.src;
    if (!source) return;

    unityLoadStarted = true;
    unityFrame.loading = 'eager';
    unityFrame.src = source;
  }

  function maybeLoadWall(progress) {
    if (wallLoadStarted || progress < .56 || !wallTiles.length) return;
    wallLoadStarted = true;

    wallTiles.forEach((tile) => {
      const source = tile.dataset.src;
      if (!source) return;
      tile.addEventListener('load', () => tile.classList.add('is-loaded'), { once: true });
      tile.addEventListener('error', () => tile.classList.add('is-failed'), { once: true });
      tile.decoding = 'async';
      tile.src = source;
      if (tile.dataset.wallTile === '0') waterSurfaceImage?.setAttribute('href', source);
    });
  }

  function flightState(progress, width, height, figureSize) {
    const travel = clamp((progress - .01) / .72);
    const path = easeInOut(travel);
    const scale = .14 + 1.02 * Math.pow(travel, 1.12);
    const centerX = lerp(-width * .18, width * .82, path);
    const centerY = lerp(height * 1.02, height * .18, path) - Math.sin(path * Math.PI) * height * .07;
    const fadeIn = smoothstep(.015, .09, progress);
    const fadeOut = 1 - smoothstep(.64, .73, progress);

    return {
      travel,
      path,
      centerX,
      centerY,
      scale,
      x: centerX - figureSize / 2,
      y: centerY - figureSize / 2,
      depth: lerp(-620, 110, path),
      yaw: lerp(-13, 0, path),
      tilt: -8 + Math.sin(path * Math.PI * 2) * 3.5,
      opacity: fadeIn * fadeOut
    };
  }

  function animateTorch() {
    torchFrame = 0;
    renderedTorch.x += (targetTorch.x - renderedTorch.x) * .18;
    renderedTorch.y += (targetTorch.y - renderedTorch.y) * .18;
    scene?.style.setProperty('--torch-x', `${renderedTorch.x.toFixed(2)}%`);
    scene?.style.setProperty('--torch-y', `${renderedTorch.y.toFixed(2)}%`);

    if (Math.abs(targetTorch.x - renderedTorch.x) > .03 || Math.abs(targetTorch.y - renderedTorch.y) > .03) {
      torchFrame = window.requestAnimationFrame(animateTorch);
    }
  }

  if (scene && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (event) => {
      const bounds = scene.getBoundingClientRect();
      targetTorch.x = clamp(((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100, 0, 100);
      targetTorch.y = clamp(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100, 0, 100);
      if (!torchFrame) torchFrame = window.requestAnimationFrame(animateTorch);
    }, { passive: true });
  }

  function currentRigProgress() {
    return flightState(renderedFlightProgress, window.innerWidth, window.innerHeight, 1).travel;
  }

  function cubicPoint(a, b, c, d, t) {
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * a.x + 3 * inverse ** 2 * t * b.x + 3 * inverse * t ** 2 * c.x + t ** 3 * d.x,
      y: inverse ** 3 * a.y + 3 * inverse ** 2 * t * b.y + 3 * inverse * t ** 2 * c.y + t ** 3 * d.y
    };
  }

  function ribbonBandPath(start, controlA, controlB, end, width, phase, travel, amplitude, clock, waveSpeed) {
    const front = [];
    const back = [];
    const steps = 46;

    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const point = cubicPoint(start, controlA, controlB, end, t);
      const before = cubicPoint(start, controlA, controlB, end, Math.max(0, t - .002));
      const after = cubicPoint(start, controlA, controlB, end, Math.min(1, t + .002));
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const normalX = -dy / length;
      const normalY = dx / length;
      const firstWave = Math.sin(t * Math.PI * 4 + travel * Math.PI * 5 + phase - clock * waveSpeed);
      const secondWave = Math.sin(t * Math.PI * 8 + phase * 1.7 - clock * waveSpeed * 1.32);
      const longSweep = Math.sin(t * Math.PI * 2 + phase * .72 - clock * waveSpeed * .62);
      const wave = (firstWave * .48 + secondWave * .18 + longSweep * .34) * amplitude * Math.sin(Math.PI * t) * (.18 + .82 * t);
      const centerX = point.x + normalX * wave;
      const centerY = point.y + normalY * wave;
      const taper = .035 + .965 * Math.pow(1 - t, .42);
      const flutter = .82 + .18 * Math.sin(t * Math.PI * 8 + phase * 1.3 - clock * waveSpeed * 1.8 + travel * 3);
      const halfWidth = width * taper * flutter / 2;

      front.push(`${fmt(centerX + normalX * halfWidth)},${fmt(centerY + normalY * halfWidth)}`);
      back.push(`${fmt(centerX - normalX * halfWidth)},${fmt(centerY - normalY * halfWidth)}`);
    }

    return `M${front.join(' L')} L${back.reverse().join(' L')} Z`;
  }

  function setPath(id, data) {
    const element = document.querySelector(id);
    if (element) element.setAttribute('d', data);
  }

  function springPoint(point, target, stiffness, dt) {
    if (!point.initialized) {
      point.x = target.x;
      point.y = target.y;
      point.vx = 0;
      point.vy = 0;
      point.initialized = true;
      return { x: point.x, y: point.y };
    }

    const steps = Math.max(1, Math.ceil(dt / .012));
    const step = dt / steps;
    const damping = stiffness * 1.55;
    for (let index = 0; index < steps; index += 1) {
      point.vx += ((target.x - point.x) * stiffness * stiffness - point.vx * damping) * step;
      point.vy += ((target.y - point.y) * stiffness * stiffness - point.vy * damping) * step;
      point.x += point.vx * step;
      point.y += point.vy * step;
    }
    return { x: point.x, y: point.y };
  }

  function createTrailingRibbon(width, height, state, config, expansion, clock) {
    const minSide = Math.min(width, height);
    const direction = {
      x: width,
      y: -height * (.84 + .07 * Math.PI * Math.cos(state.path * Math.PI))
    };
    const directionLength = Math.max(1, Math.hypot(direction.x, direction.y));
    direction.x /= directionLength;
    direction.y /= directionLength;
    const normal = { x: -direction.y, y: direction.x };
    const anchorScale = state.scale * minSide;
    const start = {
      x: state.centerX + config.anchorX * anchorScale,
      y: state.centerY + config.anchorY * anchorScale
    };
    const spread = minSide * (config.spread * state.travel + config.expand * expansion) * (.42 + .58 * state.scale);
    const windPhase = clock * config.gustSpeed + config.phase;
    const gust = Math.sin(windPhase) * .11;
    const flowX = direction.x + normal.x * gust;
    const flowY = direction.y + normal.y * gust;
    const flowLength = Math.max(1, Math.hypot(flowX, flowY));
    const flow = { x: flowX / flowLength, y: flowY / flowLength };
    const flowNormal = { x: -flow.y, y: flow.x };
    const clothSway = minSide * (.065 + .12 * expansion) * (.55 + .45 * state.travel);
    const trailLength = minSide * (config.trailLength + .12 * state.travel);
    const endTarget = {
      x: start.x - flow.x * trailLength + flowNormal.x * (config.side * spread * .42 + Math.sin(windPhase - 2.2) * clothSway),
      y: start.y - flow.y * trailLength + flowNormal.y * (config.side * spread * .42 + Math.sin(windPhase - 2.2) * clothSway)
    };
    const controlATarget = {
      x: lerp(start.x, endTarget.x, .27) + flowNormal.x * (spread * config.side + Math.sin(windPhase + .25) * clothSway * .52),
      y: lerp(start.y, endTarget.y, .27) + flowNormal.y * (spread * config.side + Math.sin(windPhase + .25) * clothSway * .52)
    };
    const controlBTarget = {
      x: lerp(start.x, endTarget.x, .72) + flowNormal.x * (-spread * config.side * .72 + Math.sin(windPhase - 1.05) * clothSway * .9),
      y: lerp(start.y, endTarget.y, .72) + flowNormal.y * (-spread * config.side * .72 + Math.sin(windPhase - 1.05) * clothSway * .9)
    };
    let spring = ribbonMotion.points.get(config.id);
    if (!spring) {
      spring = { end: {}, controlA: {}, controlB: {} };
      ribbonMotion.points.set(config.id, spring);
    }
    const controlA = springPoint(spring.controlA, controlATarget, config.follow * 1.35, ribbonMotion.delta);
    const controlB = springPoint(spring.controlB, controlBTarget, config.follow, ribbonMotion.delta);
    const end = springPoint(spring.end, endTarget, config.follow * .72, ribbonMotion.delta);
    const sizeRatio = .24 + .76 * Math.min(1.18, state.scale);
    const bandWidth = minSide * (config.baseWidth + config.growWidth * state.travel + config.coverWidth * expansion) * sizeRatio;
    const d = ribbonBandPath(start, controlA, controlB, end, bandWidth, config.phase, state.travel, spread * 1.05 + clothSway * .5, clock, config.waveSpeed);

    return { d, opacity: smoothstep(.035, .16, state.travel) * (1 - smoothstep(.92, .99, state.travel)) };
  }

  function silkBloomPath(side, width, height, cover, phase, origin) {
    if (cover < .006) return '';
    const minSide = Math.min(width, height);
    const centerX = lerp(origin.x, width / 2, smoothstep(.2, 1, cover));
    const centerY = lerp(origin.y, height / 2, smoothstep(.2, 1, cover));
    const radiusX = minSide * .008 + Math.max(width * 1.45, height * 1.2) * cover;
    const radiusY = minSide * .008 + Math.max(height * 1.45, width * .88) * cover;
    const wave = minSide * .13 * cover * (1 - cover);
    const points = [];
    const seamPoints = [];
    const steps = 34;

    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const y = centerY - radiusY + radiusY * 2 * t;
      const sway = Math.sin(t * Math.PI * 4 + phase) * wave * Math.sin(t * Math.PI);
      seamPoints.push(`${fmt(centerX + sway)},${fmt(y)}`);
    }

    const startAngle = Math.PI * 1.5;
    const endAngle = side === 'left' ? Math.PI * .5 : Math.PI * 2.5;
    for (let index = 0; index <= steps; index += 1) {
      const angle = lerp(startAngle, endAngle, index / steps);
      const ripple = 1 + .045 * Math.sin(angle * 5 + phase) * cover * (1 - cover);
      const x = centerX + Math.cos(angle) * radiusX * ripple;
      const y = centerY + Math.sin(angle) * radiusY * ripple;
      points.push(`${fmt(x)},${fmt(y)}`);
    }

    return `M${seamPoints.join(' L')} L${points.join(' L')} Z`;
  }

  function silkBloomFolds(side, width, height, cover, phase, origin) {
    if (cover < .06) return '';
    const minSide = Math.min(width, height);
    const centerX = lerp(origin.x, width / 2, smoothstep(.2, 1, cover));
    const centerY = lerp(origin.y, height / 2, smoothstep(.2, 1, cover));
    const radiusX = minSide * .008 + Math.max(width * 1.45, height * 1.2) * cover;
    const radiusY = minSide * .008 + Math.max(height * 1.45, width * .88) * cover;
    const sign = side === 'left' ? -1 : 1;
    const amplitude = minSide * .035 * cover;
    const paths = [];

    for (let index = 1; index <= 6; index += 1) {
      const lane = index / 7 - .5;
      const startY = centerY + lane * Math.min(height * .76, radiusY * 1.25);
      const startX = centerX + Math.sin(index * 1.7 + phase) * amplitude * .25;
      const endX = centerX + sign * radiusX * .96;
      const endY = startY + Math.sin(phase + index * .8) * amplitude;
      const sway = Math.sin(phase + index * .8) * amplitude;
      paths.push(`M${fmt(startX)},${fmt(startY)} C${fmt(centerX + sign * radiusX * .3)},${fmt(startY + sway)} ${fmt(centerX + sign * radiusX * .7)},${fmt(endY - sway)} ${fmt(endX)},${fmt(endY)}`);
    }

    return paths.join(' ');
  }

  function paintFlightSilk(progress, width, height, state, storyProgress) {
    const viewBox = `0 0 ${fmt(width)} ${fmt(height)}`;
    if (viewBox !== lastViewBox) {
      [backRibbonSvg, frontRibbonSvg, veilSvg].forEach((svg) => svg?.setAttribute('viewBox', viewBox));
      lastViewBox = viewBox;
    }

    const now = performance.now();
    if (viewBox !== ribbonMotion.lastViewBox || progress < .02) {
      ribbonMotion.points.clear();
      ribbonMotion.lastAt = now;
      ribbonMotion.lastViewBox = viewBox;
    }
    ribbonMotion.delta = clamp((now - (ribbonMotion.lastAt || now - 16.7)) / 1000, 1 / 120, .05);
    ribbonMotion.lastAt = now;
    const clock = now * .001;
    const expansion = smoothstep(.2, .64, progress);
    const specs = [
      { id: '#ribbon-back-teal', weave: '#ribbon-back-teal-weave', anchorX: -.12, anchorY: .12, trailLength: 1.02, baseWidth: .014, growWidth: .054, coverWidth: .09, spread: .07, expand: .19, side: 1, phase: .3, follow: 3.9, waveSpeed: 2.6, gustSpeed: 2.25 },
      { id: '#ribbon-back-red', weave: '#ribbon-back-red-weave', anchorX: .03, anchorY: .18, trailLength: 1.14, baseWidth: .013, growWidth: .052, coverWidth: .086, spread: .1, expand: .18, side: -1, phase: 2.2, follow: 3.5, waveSpeed: 2.2, gustSpeed: 1.95 },
      { id: '#ribbon-back-shadow', anchorX: .13, anchorY: .03, trailLength: .92, baseWidth: .01, growWidth: .04, coverWidth: .05, spread: .12, expand: .15, side: 1, phase: 4.1, follow: 3.1, waveSpeed: 1.9, gustSpeed: 1.7 },
      { id: '#ribbon-front-teal', anchorX: .1, anchorY: .08, trailLength: 1.08, baseWidth: .008, growWidth: .034, coverWidth: .07, spread: .15, expand: .19, side: -1, phase: 1.4, follow: 4.8, waveSpeed: 3.2, gustSpeed: 2.7 },
      { id: '#ribbon-front-red', anchorX: -.03, anchorY: -.04, trailLength: .98, baseWidth: .008, growWidth: .032, coverWidth: .065, spread: .14, expand: .17, side: 1, phase: 3.5, follow: 4.3, waveSpeed: 2.9, gustSpeed: 2.5 }
    ];

    specs.forEach((config) => {
      const ribbon = createTrailingRibbon(width, height, state, config, expansion, clock);
      const shape = document.querySelector(config.id);
      shape?.setAttribute('d', ribbon.d);
      shape?.style.setProperty('--ribbon-opacity', ribbon.opacity.toFixed(3));
      if (config.weave) document.querySelector(config.weave)?.setAttribute('d', ribbon.d);
    });

    const cover = smoothstep(.28, .62, progress);
    const open = smoothstep(.73, .87, progress);
    const phase = progress * Math.PI * 5 + clock;
    const anchorScale = state.scale * Math.min(width, height);
    const origin = {
      x: state.centerX - anchorScale * .1,
      y: state.centerY + anchorScale * .12
    };
    const leftPath = silkBloomPath('left', width, height, cover, phase, origin);
    const rightPath = silkBloomPath('right', width, height, cover, phase + .35, origin);
    setPath('#veil-left-cloth', leftPath);
    setPath('#veil-left-weave', leftPath);
    setPath('#veil-left-folds', silkBloomFolds('left', width, height, cover, phase, origin));
    setPath('#veil-right-cloth', rightPath);
    setPath('#veil-right-weave', rightPath);
    setPath('#veil-right-folds', silkBloomFolds('right', width, height, cover, phase + .6, origin));
    const shift = width * 1.12 * open;
    veilLeftGroup?.setAttribute('transform', `translate(${-fmt(shift)} 0)`);
    veilRightGroup?.setAttribute('transform', `translate(${fmt(shift)} 0)`);
    flightOverlay.style.setProperty('--trail-opacity', (smoothstep(.02, .1, progress) * (1 - smoothstep(.73, .87, progress))).toFixed(3));
    flightOverlay.style.setProperty('--veil-opacity', cover.toFixed(3));
    flightOverlay.style.setProperty('--mural-visible', smoothstep(.74, .85, progress).toFixed(3));
    const entry = smoothstep(.015, .07, progress);
    const handoff = progress >= .995 ? 1 - smoothstep(0, .045, storyProgress) : 1;
    flightOverlay.style.opacity = (entry * handoff).toFixed(3);
  }

  function sendUnityProgress(progress, force = false) {
    if (!unityFrame?.contentWindow) return;
    const now = performance.now();
    const normalized = clamp(progress);
    if (!force && (now - lastUnitySentAt < 34 || Math.abs(normalized - lastUnityProgress) < .002)) return;

    lastUnitySentAt = now;
    lastUnityProgress = normalized;
    unityFrame.contentWindow.postMessage({ type: 'apsara-scroll', progress: normalized }, '*');
  }

  function mirrorUnityFrame() {
    if (!unityRenderContext || !unityFrame?.contentDocument) {
      unityCopyFrame = 0;
      return;
    }

    const sourceCanvas = unityFrame.contentDocument.querySelector('#apsara-composite');
    if (sourceCanvas?.width && sourceCanvas?.height) {
      if (unityRenderCanvas.width !== sourceCanvas.width || unityRenderCanvas.height !== sourceCanvas.height) {
        unityRenderCanvas.width = sourceCanvas.width;
        unityRenderCanvas.height = sourceCanvas.height;
      }
      unityRenderContext.clearRect(0, 0, unityRenderCanvas.width, unityRenderCanvas.height);
      unityRenderContext.drawImage(sourceCanvas, 0, 0, unityRenderCanvas.width, unityRenderCanvas.height);
    }

    unityCopyFrame = window.requestAnimationFrame(mirrorUnityFrame);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== unityFrame?.contentWindow || event.data?.type !== 'apsara-unity-ready') return;
    unityReady = true;
    if (renderedFlightProgress < .64) {
      unityChosen = true;
      flightOverlay.classList.add('is-unity-ready');
    }
    if (!unityCopyFrame) unityCopyFrame = window.requestAnimationFrame(mirrorUnityFrame);
    sendUnityProgress(currentRigProgress(), true);
  });

  unityFrame?.addEventListener('load', () => sendUnityProgress(currentRigProgress(), true));

  function setBeat(index) {
    if (index < 0 || index >= beats.length || index === currentBeat) return;
    currentBeat = index;

    beats.forEach((item, i) => item.classList.toggle('is-active', i === index));
    activeCount.textContent = String(index + 1).padStart(2, '0');
    panelCaption.textContent = captions[index];
  }

  function paintPoseFrames(chapterPosition) {
    const leftIndex = Math.min(poses.length - 1, Math.floor(chapterPosition));
    const rightIndex = Math.min(poses.length - 1, leftIndex + 1);
    const localProgress = chapterPosition - leftIndex;
    const blend = rightIndex === leftIndex ? 0 : smoothstep(.14, .84, localProgress);

    poses.forEach((pose) => {
      const poseIndex = Number(pose.dataset.poseImage);
      const opacity = poseIndex === leftIndex ? 1 - blend : poseIndex === rightIndex ? blend : 0;
      pose.style.opacity = opacity.toFixed(3);
      pose.style.transform = 'none';
    });
  }

  function paintMuralFrames(chapterPosition) {
    const leftIndex = Math.min(muralFrames.length - 1, Math.floor(chapterPosition));
    const rightIndex = Math.min(muralFrames.length - 1, leftIndex + 1);
    const localProgress = chapterPosition - leftIndex;
    const blend = rightIndex === leftIndex ? 0 : easeInOut(clamp((localProgress - .72) / .28));

    muralFrames.forEach((frame, index) => {
      const opacity = index === leftIndex ? 1 - blend : index === rightIndex ? blend : 0;
      frame.style.opacity = opacity.toFixed(3);
      frame.classList.toggle('is-active', opacity > .5);
    });
  }

  function paintSceneMuralFrames(chapterPosition, visibility = 1, width, height) {
    if (!sceneMuralCamera || !sceneMuralWall) return;
    if (scene) scene.style.opacity = visibility.toFixed(3);

    const stage = clamp(chapterPosition, 0, Math.max(0, cameraStops.length - 1));
    const worldWidth = height * (6496 / 1114);
    const overviewZoom = Math.min(1, width / worldWidth);
    const cameraPath = [
      { stage: 0, focus: .5, zoom: overviewZoom, overview: true },
      { stage: .48, focus: cameraStops[0], zoom: cameraZooms[0] },
      ...cameraStops.slice(1).map((focus, index) => ({ stage: index + 1, focus, zoom: cameraZooms[index + 1] }))
    ];
    let segment = 0;
    while (segment < cameraPath.length - 2 && stage > cameraPath[segment + 1].stage) segment += 1;
    const from = cameraPath[segment];
    const to = cameraPath[segment + 1];
    const localProgress = clamp((stage - from.stage) / Math.max(.001, to.stage - from.stage));
    const blend = smoothstep(.025, .975, localProgress);
    const focus = lerp(from.focus, to.focus, blend);
    const zoom = lerp(from.zoom, to.zoom, blend) + Math.sin(localProgress * Math.PI) * .022;
    const scaledWorldWidth = worldWidth * zoom;
    const cameraX = clamp(width / 2 - focus * scaledWorldWidth, width - scaledWorldWidth, 0);
    const fromY = from.overview ? height * .025 : (height - height * from.zoom) / 2;
    const toY = (height - height * to.zoom) / 2;
    const cameraY = lerp(fromY, toY, blend);

    sceneMuralCamera.style.setProperty('--camera-x', `${cameraX.toFixed(1)}px`);
    sceneMuralCamera.style.setProperty('--camera-y', `${cameraY.toFixed(1)}px`);
    sceneMuralWall.style.setProperty('--camera-scale', zoom.toFixed(3));

    const waterAmount = 1 - smoothstep(.18, .92, stage);
    waterRipple?.style.setProperty('--water-opacity', (waterAmount * visibility).toFixed(3));
    waterSurface?.style.setProperty('--water-surface-opacity', (waterAmount * visibility * (useLightweightFlight ? .1 : .19)).toFixed(3));
    waterRipple?.style.setProperty('--water-offset', `${(-stage * 96).toFixed(1)}px`);
    if (!useLightweightFlight) {
      waterNoise?.setAttribute('baseFrequency', `0.014 ${(0.036 + Math.sin(stage * Math.PI) * .012).toFixed(3)}`);
      waterDisplacement?.setAttribute('scale', (2.2 + Math.sin(stage * Math.PI) * 1.2).toFixed(2));
    }
  }

  function renderTimeline(progress, flightProgress = renderedFlightProgress) {
    const chapterPosition = clamp(progress) * Math.max(0, beats.length - 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const figureSize = Math.min(height * 1.02, width * .94, 880);
    const motion = flightState(flightProgress, width, height, figureSize);
    maybeLoadUnity(flightProgress);
    maybeLoadWall(flightProgress);
    if (unityReady && !unityChosen && flightProgress < .64) {
      unityChosen = true;
      flightOverlay.classList.add('is-unity-ready');
    }
    // Unity runs its skeletal cycle on its own clock; scroll only moves the whole figure.
    sendUnityProgress(motion.travel);
    const beatIndex = Math.min(beats.length - 1, Math.round(chapterPosition));
    // Keep the first act behind the opening sleeve wipe until it has fully handed off.
    const storyIsRevealed = story && flightProgress >= .995 && progress >= .1;
    if (storyIsRevealed) {
      setBeat(beatIndex);
    } else if (currentBeat !== -1) {
      currentBeat = -1;
      beats.forEach((item) => item.classList.remove('is-active'));
    }
    const poseProgress = clamp((flightProgress - .025) / .58);
    paintPoseFrames(poseProgress * Math.max(0, poses.length - 1));
    paintMuralFrames(chapterPosition);
    // Let the opening mural layer finish fading before the scroll chapter wall fades in.
    const sceneMuralVisibility = flightProgress >= .995 ? smoothstep(.052, .112, progress) : 0;
    paintSceneMuralFrames(chapterPosition, sceneMuralVisibility, width, height);

    flightOverlay.style.setProperty('--figure-size', `${figureSize.toFixed(1)}px`);
    flightOverlay.style.setProperty('--flight-x', `${motion.x.toFixed(1)}px`);
    flightOverlay.style.setProperty('--flight-y', `${motion.y.toFixed(1)}px`);
    flightOverlay.style.setProperty('--flight-depth', `${motion.depth.toFixed(1)}px`);
    flightOverlay.style.setProperty('--flight-yaw', `${motion.yaw.toFixed(2)}deg`);
    flightOverlay.style.setProperty('--flight-scale', motion.scale.toFixed(3));
    flightOverlay.style.setProperty('--flight-tilt', `${motion.tilt.toFixed(2)}deg`);
    flightOverlay.style.setProperty('--figure-opacity', motion.opacity.toFixed(3));
    flightOverlay.style.setProperty('--flight-opacity', smoothstep(.025, .1, flightProgress).toFixed(3));
    paintFlightSilk(flightProgress, width, height, motion, chapterPosition / Math.max(1, beats.length - 1));

    if (scene) {
      const drift = Math.sin(progress * Math.PI * 2);
      scene.style.setProperty('--wall-x', `${(drift * -24).toFixed(1)}px`);
      scene.style.setProperty('--wall-y', `${(Math.cos(progress * Math.PI * 2) * 11).toFixed(1)}px`);
      scene.style.setProperty('--wall-scale', (1.035 + Math.sin(progress * Math.PI) * .025).toFixed(3));
      scene.style.setProperty('--meta-y', `${(Math.cos(progress * Math.PI * 2) * -6).toFixed(1)}px`);
      scene.style.setProperty('--meta-x', `${(drift * 8).toFixed(1)}px`);
    }
  }

  function readScrollProgress() {
    if (!story) return 0;
    const storyTop = window.scrollY + story.getBoundingClientRect().top;
    const scrollDistance = Math.max(1, story.offsetHeight - window.innerHeight);
    return clamp((window.scrollY - storyTop) / scrollDistance);
  }

  function syncEndingMural() {
    if (!ending) return;
    const bounds = ending.getBoundingClientRect();
    const travel = Math.max(1, window.innerHeight + bounds.height);
    const progress = clamp((window.innerHeight - bounds.top) / travel);
    const muralWidth = bounds.height * 1.04 * muralAspectRatio;
    const panDistance = Math.max(0, muralWidth - window.innerWidth);
    ending.style.setProperty('--ending-mural-x', `${(-panDistance * progress).toFixed(1)}px`);
  }

  function readFlightProgress() {
    if (!story) return 0;
    const storyTop = window.scrollY + story.getBoundingClientRect().top;
    const flightDistance = Math.max(1, storyTop);
    const flightStart = Math.max(0, storyTop - flightDistance);
    return clamp((window.scrollY - flightStart) / flightDistance);
  }

  function animateToTarget(now) {
    timelineFrame = 0;
    const elapsed = lastFrameTime ? Math.min(64, now - lastFrameTime) : 16;
    lastFrameTime = now;
    const storyFollow = reduceMotion ? 1 : 1 - Math.exp(-elapsed / 110);
    const flightFollow = reduceMotion ? 1 : 1 - Math.exp(-elapsed / 240);
    renderedProgress += (targetProgress - renderedProgress) * storyFollow;
    renderedFlightProgress += (targetFlightProgress - renderedFlightProgress) * flightFollow;

    if (Math.abs(targetProgress - renderedProgress) < .0005) renderedProgress = targetProgress;
    if (Math.abs(targetFlightProgress - renderedFlightProgress) < .0005) renderedFlightProgress = targetFlightProgress;
    renderTimeline(renderedProgress, renderedFlightProgress);

    const flightIsAlive = !reduceMotion && renderedFlightProgress > .02 && renderedFlightProgress < .995;
    if (renderedProgress !== targetProgress || renderedFlightProgress !== targetFlightProgress || flightIsAlive) {
      timelineFrame = window.requestAnimationFrame(animateToTarget);
    } else {
      lastFrameTime = 0;
    }
  }

  function syncScroll() {
    syncEndingMural();
    targetProgress = readScrollProgress();
    targetFlightProgress = readFlightProgress();
    if (reduceMotion) {
      renderedProgress = targetProgress;
      renderedFlightProgress = targetFlightProgress;
      renderTimeline(renderedProgress, renderedFlightProgress);
      return;
    }
    if (!timelineFrame) timelineFrame = window.requestAnimationFrame(animateToTarget);
  }

  window.addEventListener('scroll', syncScroll, { passive: true });
  window.addEventListener('resize', syncScroll, { passive: true });
  window.addEventListener('load', syncScroll, { once: true });
  syncScroll();
})();
