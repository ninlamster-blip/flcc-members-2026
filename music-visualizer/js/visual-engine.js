import * as THREE from 'three';

const RING_POOL_SIZE = 14;
const MAX_PARTICLES = 3000;
const MIN_PARTICLES = 500;

function makeGlowSprite() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const BG_VERTEX = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BG_FRAGMENT = `
varying vec3 vPos;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i), n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0)), n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1)), n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1)), n111 = hash(i + vec3(1,1,1));
  float nx00 = mix(n000, n100, f.x), nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x), nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y), nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

void main() {
  vec3 p = normalize(vPos) * 2.4 + vec3(0.0, uTime * 0.012, uTime * 0.006);
  float n = vnoise(p * 1.5) * 0.55 + vnoise(p * 3.1 + 10.0) * 0.3 + vnoise(p * 6.5 + 20.0) * 0.15;
  vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.85, n));
  gl_FragColor = vec4(col, 1.0);
}`;

export class VisualEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.composer = null;
    this.bloomPass = null;
    this._particleBudget = MAX_PARTICLES;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
    this.baseFov = 52;

    this._cameraTheta = 0;
    this._cameraPhi = 1.35;
    this._kickImpulse = 0;
    this._snareFlash = 0;
    // Decaying, event-only camera jolt — deliberately NOT driven by
    // continuous per-frame energy (see update()). A scene that vibrates
    // constantly in response to raw sustained bass level, rather than
    // settling between discrete hits, is the kind of rapid, high-frequency
    // motion that can be genuinely uncomfortable or risky for photosensitive
    // viewers; a clean boom-then-settle on actual beats is not.
    this._shakeImpulse = 0;
    this._lastMomentId = 0;

    this._buildBackground();
    this._buildCore();
    this._buildRings();
    this._buildParticles(this._particleBudget);
    this._buildRibbons();
    this._buildLights();
    this._buildFlashOverlay();

    window.addEventListener('resize', () => this.resize());
  }

  async initPostFX() {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
      ]);
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 1.1, 0.75, 0.15
      );
      this.composer.addPass(this.bloomPass);
      this.resize();
    } catch (err) {
      // CDN unreachable or examples path changed — fall back to plain rendering.
      console.warn('[music-visualizer] bloom postprocessing unavailable, rendering without it', err);
      this.composer = null;
    }
  }

  _buildBackground() {
    const geo = new THREE.SphereGeometry(50, 32, 24);
    this.bgUniforms = {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(0x05050a) },
      uColorB: { value: new THREE.Color(0x120814) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: BG_VERTEX,
      fragmentShader: BG_FRAGMENT,
      uniforms: this.bgUniforms,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.bgMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.bgMesh);
  }

  _buildCore() {
    const geo = new THREE.IcosahedronGeometry(0.55, 3);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x111122, emissive: 0xff6a2c, emissiveIntensity: 1.1,
      metalness: 0.35, roughness: 0.35,
    });
    this.core = new THREE.Mesh(geo, this.coreMat);
    this.scene.add(this.core);

    this.coreWireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.16 });
    this.coreWire = new THREE.Mesh(geo.clone(), this.coreWireMat);
    this.coreWire.scale.setScalar(1.015);
    this.scene.add(this.coreWire);
  }

  _buildRings() {
    const geo = new THREE.TorusGeometry(1, 0.035, 8, 64);
    this.ringPool = [];
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.rotation.x = Math.PI / 2;
      this.scene.add(mesh);
      this.ringPool.push({ mesh, active: false, life: 0, maxLife: 1, flavor: 'kick' });
    }
  }

  _spawnRing(flavor, hue, strength = 1) {
    const slot = this.ringPool.find((r) => !r.active);
    if (!slot) return;
    // A soft hit still reads as a ring, a hard hit reads noticeably bigger —
    // 0.55..1.15x range keeps quiet passages from looking dead while giving
    // loud hits real punch.
    const intensity = 0.55 + Math.min(1, strength) * 0.6;
    const baseScale = (flavor === 'snare' ? 0.6 : 0.4) * (0.8 + intensity * 0.3);
    slot.active = true;
    slot.life = 0;
    slot.flavor = flavor;
    slot.baseScale = baseScale;
    slot.baseOpacity = (flavor === 'snare' ? 0.9 : 0.7) * intensity;
    slot.growth = (flavor === 'snare' ? 5.5 : 3.2) * (0.85 + intensity * 0.35);
    slot.maxLife = flavor === 'snare' ? 0.45 : 0.9;
    slot.mesh.visible = true;
    slot.mesh.scale.setScalar(baseScale);
    slot.mesh.rotation.z = Math.random() * Math.PI;
    slot.mesh.rotation.x = flavor === 'snare' ? (Math.random() - 0.5) * 0.6 + Math.PI / 2 : Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    slot.mesh.material.color.setHSL(hue, 0.8, flavor === 'snare' ? 0.85 : 0.6);
    slot.mesh.material.opacity = slot.baseOpacity;
  }

  _updateRings(dt) {
    for (const slot of this.ringPool) {
      if (!slot.active) continue;
      slot.life += dt;
      const t = slot.life / slot.maxLife;
      if (t >= 1) { slot.active = false; slot.mesh.visible = false; continue; }
      slot.mesh.scale.setScalar(slot.baseScale + t * slot.growth);
      slot.mesh.material.opacity = slot.baseOpacity * (1 - t);
    }
  }

  _buildParticles(count) {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const phis = new Float32Array(count);
    const thetas = new Float32Array(count);
    const speeds = new Float32Array(count);
    const sparkle = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      radii[i] = 2.2 + Math.random() * 4.5;
      phis[i] = Math.acos(2 * Math.random() - 1);
      thetas[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.05 + Math.random() * 0.18;
      this._writeParticlePosition(positions, i, radii[i], phis[i], thetas[i]);
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.05, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      map: this._glowSprite || (this._glowSprite = makeGlowSprite()),
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
    this._particleState = { count, radii, phis, thetas, speeds, sparkle };
  }

  _writeParticlePosition(positions, i, r, phi, theta) {
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // The AI Director's occasional "moment" — a much bigger sparkle burst
  // than a single hi-hat hit gives, for a one-off "the scene just did
  // something" beat roughly every 7-13s. Still just the existing
  // sparkle-decay system (gradual fade, not an instant flash), just a lot
  // more particles at once.
  _burstParticles() {
    if (!this._particleState) return;
    const { count, sparkle } = this._particleState;
    const burstCount = Math.min(count, Math.round(count * 0.35));
    for (let i = 0; i < burstCount; i++) {
      sparkle[(Math.random() * count) | 0] = 1;
    }
  }

  _updateParticles(dt, elapsed, secondaryHue, hihat) {
    const { count, radii, phis, thetas, speeds, sparkle } = this._particleState;
    const positions = this.particles.geometry.attributes.position.array;
    const colors = this.particles.geometry.attributes.color.array;

    if (hihat.hit) {
      const burst = Math.min(count, 40);
      for (let b = 0; b < burst; b++) {
        sparkle[(Math.random() * count) | 0] = 1;
      }
    }

    const baseColor = new THREE.Color().setHSL(secondaryHue, 0.75, 0.55);
    const sparkColor = new THREE.Color(0xffffff);
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      thetas[i] += speeds[i] * dt * 0.25;
      const wobble = Math.sin(elapsed * 0.6 + i) * 0.15;
      this._writeParticlePosition(positions, i, radii[i] + wobble, phis[i], thetas[i]);

      if (sparkle[i] > 0) sparkle[i] = Math.max(0, sparkle[i] - dt * 2.2);
      tmp.copy(baseColor).lerp(sparkColor, sparkle[i]);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
    this.particles.rotation.y = elapsed * 0.03;
  }

  _buildRibbons() {
    this.ribbons = [];
    const RIBBON_COUNT = 5;
    const POINTS = 80;
    for (let i = 0; i < RIBBON_COUNT; i++) {
      const positions = new Float32Array(POINTS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      this.ribbons.push({
        line, points: POINTS, phase: Math.random() * Math.PI * 2,
        tilt: (Math.random() - 0.5) * Math.PI, radiusOffset: 2.6 + i * 0.35,
      });
    }
  }

  _updateRibbons(elapsed, vocalsEnergy, hue) {
    for (let r = 0; r < this.ribbons.length; r++) {
      const rb = this.ribbons[r];
      const positions = rb.line.geometry.attributes.position.array;
      const amp = 0.4 + vocalsEnergy * 1.6;
      for (let i = 0; i < rb.points; i++) {
        const t = i / (rb.points - 1);
        const angle = t * Math.PI * 2 + elapsed * 0.3 + rb.phase;
        const x = Math.cos(angle) * rb.radiusOffset;
        const z = Math.sin(angle) * rb.radiusOffset;
        const y = Math.sin(angle * 3 + elapsed * 1.4 + rb.phase) * amp * Math.sin(t * Math.PI);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y + Math.sin(rb.tilt) * 0.3;
        positions[i * 3 + 2] = z;
      }
      rb.line.geometry.attributes.position.needsUpdate = true;
      rb.line.rotation.x = rb.tilt * 0.3;
      rb.line.material.opacity = 0.08 + vocalsEnergy * 0.55;
      rb.line.material.color.setHSL((hue + r * 0.03) % 1, 0.7, 0.6);
    }
  }

  _buildLights() {
    this.coreLight = new THREE.PointLight(0xff6a2c, 2, 30, 2);
    this.scene.add(this.coreLight);
    this.scene.add(new THREE.AmbientLight(0x404050, 0.6));
  }

  _buildFlashOverlay() {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.flashMesh = new THREE.Mesh(geo, mat);
    this.flashCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
    this.flashCamera.position.z = 1;
    this.flashScene = new THREE.Scene();
    this.flashScene.add(this.flashMesh);
  }

  setParticleBudget(n) {
    const clamped = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, Math.round(n)));
    if (Math.abs(clamped - this._particleBudget) < 150) return;
    this._particleBudget = clamped;
    this._buildParticles(clamped);
  }

  setPixelRatioScale(scale) {
    const target = Math.min(window.devicePixelRatio || 1, 2) * scale;
    this.renderer.setPixelRatio(Math.max(0.6, Math.min(2, target)));
  }

  update(features, directorState) {
    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;
    const { bands, overallEnergySmoothed } = features;

    // Impulse decay — everything below is boom-on-event-then-settle, not
    // continuously driven by raw per-frame energy. See the comment on
    // _shakeImpulse in the constructor for why.
    this._kickImpulse *= Math.pow(0.0025, dt);
    this._snareFlash *= Math.pow(0.0008, dt);
    this._shakeImpulse *= Math.pow(0.002, dt);

    // reactivity comes from the AI Director's current theme read — the same
    // kick drum should slam an EDM/Rock scene and barely nudge a Classical
    // one, which is what makes the direction feel genre-aware rather than
    // just a fixed color filter over identical physics.
    const reactivity = directorState.reactivity ?? 1;
    if (bands.kick.hit) {
      this._kickImpulse = Math.min(1.9, this._kickImpulse + (bands.kick.strength * 1.8 + 0.55) * reactivity);
      this._shakeImpulse = Math.min(1, this._shakeImpulse + bands.kick.strength * 0.9 * reactivity);
      this._spawnRing('kick', directorState.hue, bands.kick.strength * reactivity);
    }
    if (bands.bass.hit) {
      // Bass notes aren't as sharp-edged as a kick drum, so a gentler boom —
      // no ring of its own (kick's ring already reads as "the low end hit"
      // when they land together, which is common) — just adds to the same
      // impulse/shake so a strong bass note still visibly registers.
      this._kickImpulse = Math.min(1.9, this._kickImpulse + bands.bass.strength * 1.1 * reactivity);
      this._shakeImpulse = Math.min(1, this._shakeImpulse + bands.bass.strength * 0.6 * reactivity);
    }
    if (bands.snare.hit) {
      this._snareFlash = Math.min(0.55, this._snareFlash + 0.4 * reactivity);
      this._spawnRing('snare', directorState.secondaryHue, bands.snare.strength * reactivity);
    }

    // Beat anticipation — a small glow ramp in the final stretch before a
    // *predicted* beat (from the audio engine's BPM-phase estimate), so the
    // reaction feels anticipated rather than always trailing the actual
    // detection by a frame or two. Capped small, purely additive to the
    // already-gentle emissive term below, and only active once BPM is
    // genuinely locked — never an independent flash of its own.
    let beatAnticipation = 0;
    if (features.beatPhase != null) {
      const t = Math.max(0, features.beatPhase - 0.82) / 0.18;
      beatAnticipation = t * t; // ease-in: barely there until right at the end
    }

    // One-shot "moment" from the director (a particle burst, currently) —
    // fires once per new momentId, not every frame it stays the same.
    if (directorState.momentType === 'burst' && directorState.momentId !== this._lastMomentId) {
      this._lastMomentId = directorState.momentId;
      this._burstParticles();
    }

    // Background
    this.bgUniforms.uTime.value = elapsed;
    this.bgUniforms.uColorA.value.setHSL(directorState.bgHue, directorState.sat * 0.5, directorState.bgLight);
    this.bgUniforms.uColorB.value.setHSL(directorState.hue, directorState.sat * 0.6, directorState.bgLight + 0.06);

    // Core — scale/glow track the smoothed overall level only very gently
    // (a slow-moving loudness trend is not a flash risk) and lean on the
    // event-driven impulse for the actual "boom."
    const targetScale = 1 + overallEnergySmoothed * 0.18 + this._kickImpulse * 1.1;
    this.core.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.0006, dt));
    this.coreWire.scale.copy(this.core.scale).multiplyScalar(1.015);
    this.core.rotation.y += dt * (0.12 + overallEnergySmoothed * 0.3);
    this.core.rotation.x += dt * 0.05;
    this.coreWire.rotation.copy(this.core.rotation);
    this.coreMat.emissive.setHSL(directorState.hue, 0.85, 0.5 + this._kickImpulse * 0.18);
    this.coreMat.emissiveIntensity = 0.85 + overallEnergySmoothed * 1.0 + this._kickImpulse * 1.8 + beatAnticipation * 0.35 * reactivity;

    this._updateRings(dt);
    this._updateParticles(dt, elapsed, directorState.secondaryHue, bands.hihat);
    this._updateRibbons(elapsed, bands.vocals.energy, directorState.secondaryHue);

    // Lighting
    this.coreLight.color.setHSL(directorState.hue, 0.85, 0.55);
    this.coreLight.intensity = 1.4 + overallEnergySmoothed * 2.5 + this._kickImpulse * 7;

    // Camera choreography: the AI Director periodically hands over a
    // different "move" (orbit/push/drift/flythrough, see ai-director.js) as
    // sceneParams, smoothly crossfaded — this is what keeps a whole song
    // from feeling like one looping animation. The "vibrate" on top is
    // _shakeImpulse only — a brief, decaying jolt set on kick/bass hits
    // above, not a continuous shake driven by raw sustained bass level (see
    // the constructor comment on _shakeImpulse for why that distinction
    // matters here).
    const sp = directorState.sceneParams || { radiusBase: 7.2, radiusAmp: 0, radiusFreq: 0, thetaSpeedMult: 1, driftAmp: 0, fovBias: 0 };
    this._cameraTheta += dt * 0.12 * directorState.cameraSpeed * sp.thetaSpeedMult;
    const shakeAmt = this._shakeImpulse * 0.13;
    const shakeX = Math.sin(elapsed * 11) * shakeAmt + Math.sin(elapsed * 5.3) * shakeAmt * 0.5;
    const shakeY = Math.cos(elapsed * 9) * shakeAmt;
    const modeRadius = sp.radiusBase + Math.sin(elapsed * sp.radiusFreq) * sp.radiusAmp;
    // flythrough's radius range is small enough that a hard kick at the
    // near-phase could otherwise push this negative, flipping the camera
    // straight through the core to the opposite side — clamp well clear of
    // the core (radius 0.55) and the near clip plane.
    const radius = Math.max(1.2, modeRadius - this._kickImpulse * 1.3);
    const driftY = Math.sin(this._cameraPhi + elapsed * 0.05) * 1.2 + Math.sin(elapsed * 0.17) * sp.driftAmp;
    this.camera.position.set(
      Math.sin(this._cameraTheta) * radius + shakeX,
      driftY + shakeY,
      Math.cos(this._cameraTheta) * radius
    );
    this.camera.fov = this.baseFov + sp.fovBias + this._kickImpulse * 9;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0, 0);

    // Snare flash overlay
    this.flashMesh.material.opacity = this._snareFlash;

    return { fov: this.camera.fov };
  }

  render() {
    if (this.composer) {
      // Base ambient bloom (from the director's theme+energy read) plus a
      // beat-synced flash so the glow itself visibly pops in time with the
      // kick, not just the core's shape.
      if (this.bloomPass) this.bloomPass.strength = Math.min(3.2, (this._lastBloom || 1.1) + this._kickImpulse * 0.9);
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this._snareFlash > 0.002) {
      this.renderer.autoClear = false;
      this.renderer.render(this.flashScene, this.flashCamera);
      this.renderer.autoClear = true;
    }
  }

  setBloomStrength(v) {
    this._lastBloom = v;
    if (this.bloomPass) this.bloomPass.strength = v;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
  }
}
