(() => {
  const portal = document.querySelector('#portal');
  const eyeHit = document.querySelector('#eye-hit');
  const faceImage = document.querySelector('.opening__face-image');
  const faceCanvas = document.querySelector('#face-canvas');
  const faceFrame = document.querySelector('.opening__face-frame');
  const opening = document.querySelector('#opening');
  const world = document.querySelector('#story-world');
  const catalogLink = document.querySelector('#catalog-link');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!portal || !eyeHit || !world) return;

  let phase = 'loading';
  let eyeMotion;
  let artPromise;
  const flightMotion = window.DunhuangFlight?.create(world);
  const flightDuration = window.DunhuangFlight?.duration || 3400;
  const journeyTimers = new Set();

  function scheduleJourney(callback, delay) {
    const id = window.setTimeout(() => {
      journeyTimers.delete(id);
      if (phase === 'flight') callback();
    }, delay);
    journeyTimers.add(id);
  }

  function setPhase(nextPhase) {
    phase = nextPhase;
    portal.dataset.phase = nextPhase;
  }

  function loadStoryWorldArt() {
    if (artPromise) return artPromise;
    const images = [...world.querySelectorAll('[data-src]')];
    images.forEach((image) => {
      image.src = image.dataset.src;
      image.removeAttribute('data-src');
    });
    artPromise = Promise.allSettled(images.map(image => image.decode()));
    return artPromise;
  }

  async function prepareOpening() {
    try {
      await faceImage.decode();
      if (phase !== 'loading') return;
      eyeMotion = window.DunhuangEye.create(faceImage, faceCanvas);
      faceFrame.classList.add('has-eye-motion');
      setPhase('draw');
      // Decode the next scene while the face and eyelids animate.
      loadStoryWorldArt();
      await new Promise(resolve => window.setTimeout(resolve, reducedMotion ? 0 : 1650));
      if (phase !== 'draw') return;
      setPhase('opening');
      await eyeMotion.open(reducedMotion);
      if (phase !== 'opening') return;
      setPhase('ready');
      eyeHit.disabled = false;
    } catch (error) {
      // Keep the original illustration and directory link usable if canvas is unavailable.
      console.error('Eye animation could not initialize:', error);
      if (phase === 'map') return;
      faceFrame.classList.remove('has-eye-motion');
      setPhase('ready');
      eyeHit.disabled = false;
    }
  }

  function showDirectory(instant = false) {
    eyeMotion?.stop();
    flightMotion?.stop();
    journeyTimers.forEach(id => window.clearTimeout(id));
    journeyTimers.clear();
    loadStoryWorldArt();
    eyeHit.disabled = true;
    opening.inert = true;
    world.inert = false;
    world.setAttribute('aria-hidden', 'false');
    world.classList.toggle('is-instant', instant);
    world.classList.add('is-visible', 'is-mapped');
    world.classList.remove('is-entering');
    world.classList.remove('is-settling');
    setPhase('map');
    world.querySelector('h1')?.focus({ preventScroll: true });
    opening.setAttribute('aria-hidden', 'true');
  }

  function beginOneTouchJourney() {
    if (phase !== 'ready') return;
    eyeHit.disabled = true;
    opening.inert = true;
    setPhase('flight');
    world.inert = true;
    world.classList.add('is-visible');
    loadStoryWorldArt();

    if (reducedMotion) {
      showDirectory(true);
      return;
    }

    // The silk begins behind the peak of the eye's golden bloom.
    scheduleJourney(() => {
      world.classList.add('is-entering');
      flightMotion?.start();
    }, 800);
    scheduleJourney(() => world.classList.add('is-settling'), 800 + flightDuration * .8);
    scheduleJourney(() => showDirectory(), 800 + flightDuration);
  }

  prepareOpening();

  eyeHit.addEventListener('click', beginOneTouchJourney);
  catalogLink?.addEventListener('click', (event) => {
    event.preventDefault();
    eyeHit.disabled = true;
    showDirectory(true);
  });
})();
