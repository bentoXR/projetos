import Phaser from 'phaser';
import { PALETTE } from '../data/palette';

/**
 * Any Phaser display object that supports position, scale, rotation, and alpha.
 * Uses AlphaSingle so Containers, Graphics, Shapes, Sprites, and Text all match.
 */
export type AnimatableObject = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.AlphaSingle;

export interface PopInOptions {
  duration?: number;
  delay?: number;
  fromScale?: number;
  targetScale?: number;
  ease?: string;
  onComplete?: () => void;
}

export interface WobbleOptions {
  angleDeg?: number;
  duration?: number;
  repeat?: number;
  squash?: number;
  onComplete?: () => void;
}

export interface SketchPoint {
  x: number;
  y: number;
}

export interface DrawInOptions {
  /** Custom polylines in the object's local coordinate space. */
  paths?: SketchPoint[][];
  /** Duration of the line-by-line sketch phase in ms. */
  drawDuration?: number;
  /** Duration of the fill reveal phase in ms. */
  fillDuration?: number;
  strokeColor?: number;
  strokeWidth?: number;
  /** Subtle hand-drawn jitter amplitude in pixels. */
  jitter?: number;
  /** Fallback width if the target has no measurable bounds. */
  fallbackWidth?: number;
  /** Fallback height if the target has no measurable bounds. */
  fallbackHeight?: number;
  onComplete?: () => void;
}

export interface DrawInHandle {
  stop: () => void;
  promise: Promise<void>;
}

export interface FadeOutOptions {
  duration?: number;
  delay?: number;
  shrinkTo?: number;
  destroyOnComplete?: boolean;
  onComplete?: () => void;
}

export interface PulseHintOptions {
  scaleFactor?: number;
  minAlpha?: number;
  duration?: number;
}

export interface PulseHintHandle {
  tween: Phaser.Tweens.Tween;
  stop: () => void;
}

/**
 * Elastic pop-in entrance: starts collapsed and springs into full scale.
 */
export function popIn(
  scene: Phaser.Scene,
  target: AnimatableObject,
  options: PopInOptions = {},
): Phaser.Tweens.Tween {
  const {
    duration = 460,
    delay = 0,
    fromScale = 0.01,
    targetScale = 1,
    ease = 'Back.easeOut',
    onComplete,
  } = options;

  scene.tweens.killTweensOf(target);
  target.setScale(fromScale);
  target.setAlpha(0);

  return scene.tweens.add({
    targets: target,
    scaleX: targetScale,
    scaleY: targetScale,
    alpha: { from: 0, to: 1, duration: Math.min(180, duration * 0.45) },
    duration,
    delay,
    ease,
    onComplete: () => {
      target.setAlpha(1);
      onComplete?.();
    },
  });
}

/**
 * Playful rotational wobble with a subtle squash-and-stretch feel.
 */
export function wobble(
  scene: Phaser.Scene,
  target: AnimatableObject,
  options: WobbleOptions = {},
): Phaser.Tweens.Tween {
  const {
    angleDeg = 7,
    duration = 380,
    repeat = 0,
    squash = 0.05,
    onComplete,
  } = options;

  const baseAngle = target.angle;
  const baseScaleX = target.scaleX;
  const baseScaleY = target.scaleY;

  return scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    repeat,
    ease: 'Sine.easeInOut',
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      const damp = 1 - t * 0.65;
      const wave = Math.sin(t * Math.PI * 3);
      target.setAngle(baseAngle + wave * angleDeg * damp);
      target.setScale(
        baseScaleX * (1 + wave * squash * damp),
        baseScaleY * (1 - wave * squash * damp),
      );
    },
    onComplete: () => {
      target.setAngle(baseAngle);
      target.setScale(baseScaleX, baseScaleY);
      onComplete?.();
    },
  });
}

/**
 * Builds a default rounded-rectangle sketch path around a target when custom
 * polylines are not provided.
 */
function buildDefaultSketchPaths(
  target: AnimatableObject,
  fallbackWidth: number,
  fallbackHeight: number,
): SketchPoint[][] {
  let width = fallbackWidth;
  let height = fallbackHeight;

  const measurable = target as unknown as {
    getBounds?: () => Phaser.Geom.Rectangle;
    displayWidth?: number;
    displayHeight?: number;
  };

  if (typeof measurable.getBounds === 'function') {
    const bounds = measurable.getBounds();
    if (bounds.width > 4 && bounds.height > 4) {
      width = bounds.width;
      height = bounds.height;
    }
  } else if (
    typeof measurable.displayWidth === 'number' &&
    measurable.displayWidth > 4 &&
    typeof measurable.displayHeight === 'number' &&
    measurable.displayHeight > 4
  ) {
    width = measurable.displayWidth;
    height = measurable.displayHeight;
  }

  const hw = width / 2;
  const hh = height / 2;

  // Four separate strokes so it visibly draws line by line like a quick sketch.
  return [
    [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
    ],
    [
      { x: hw, y: -hh },
      { x: hw, y: hh },
    ],
    [
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ],
    [
      { x: -hw, y: hh },
      { x: -hw, y: -hh },
    ],
  ];
}

/**
 * Adds deterministic, subtle hand-drawn wobble to each segment of a polyline.
 */
function subdivideWithJitter(
  points: SketchPoint[],
  jitter: number,
  seedOffset: number,
): SketchPoint[] {
  if (points.length < 2) return points;
  const result: SketchPoint[] = [points[0]];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const steps = Math.max(2, Math.ceil(dist / 18));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const isEndpoint = s === steps;
      const noiseA = Math.sin((i * 13 + s * 7 + seedOffset) * 1.7);
      const noiseB = Math.cos((i * 17 + s * 5 + seedOffset) * 1.3);
      const offsetScale = isEndpoint ? 0 : jitter;

      result.push({
        x: Phaser.Math.Linear(a.x, b.x, t) + noiseA * offsetScale,
        y: Phaser.Math.Linear(a.y, b.y, t) + noiseB * offsetScale,
      });
    }
  }

  return result;
}

/**
 * Reveals any object as if hand-sketched line by line, then smoothly fills it
 * in with its final solid geometry.
 */
export function drawIn(
  scene: Phaser.Scene,
  target: AnimatableObject,
  options: DrawInOptions = {},
): DrawInHandle {
  const {
    paths,
    drawDuration = 680,
    fillDuration = 280,
    strokeColor = PALETTE.stroke,
    strokeWidth = 3.5,
    jitter = 1.6,
    fallbackWidth = 96,
    fallbackHeight = 72,
    onComplete,
  } = options;

  const rawPaths =
    paths && paths.length > 0
      ? paths
      : buildDefaultSketchPaths(target, fallbackWidth, fallbackHeight);

  const sketchPaths = rawPaths.map((poly, index) =>
    subdivideWithJitter(poly, jitter, index + 1),
  );

  // Measure total stroke length across all polylines for uniform drawing speed.
  const segmentLengths: number[][] = [];
  let totalLength = 0;

  for (const poly of sketchPaths) {
    const lengths: number[] = [];
    for (let i = 0; i < poly.length - 1; i++) {
      const len = Phaser.Math.Distance.Between(
        poly[i].x,
        poly[i].y,
        poly[i + 1].x,
        poly[i + 1].y,
      );
      lengths.push(len);
      totalLength += len;
    }
    segmentLengths.push(lengths);
  }

  const finalAlpha = target.alpha > 0 ? target.alpha : 1;
  target.setAlpha(0);

  const sketch = scene.add.graphics();
  sketch.setPosition(target.x, target.y);
  sketch.setRotation(target.rotation);
  sketch.setScale(target.scaleX, target.scaleY);

  const depthable = target as unknown as { depth?: number };
  if (typeof depthable.depth === 'number') {
    sketch.setDepth(depthable.depth + 1);
  }

  let stopped = false;
  let activeTween: Phaser.Tweens.Tween | null = null;
  let resolvePromise: (() => void) | null = null;

  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  const renderProgress = (progress: number): void => {
    sketch.clear();
    sketch.lineStyle(strokeWidth, strokeColor, 1);

    let remaining = totalLength * Phaser.Math.Clamp(progress, 0, 1);

    for (let p = 0; p < sketchPaths.length && remaining > 0; p++) {
      const poly = sketchPaths[p];
      const lengths = segmentLengths[p];
      if (poly.length < 2) continue;

      sketch.beginPath();
      sketch.moveTo(poly[0].x, poly[0].y);

      for (let i = 0; i < lengths.length && remaining > 0; i++) {
        const segLen = lengths[i];
        const nextPt = poly[i + 1];

        if (remaining >= segLen) {
          sketch.lineTo(nextPt.x, nextPt.y);
          remaining -= segLen;
        } else {
          const ratio = segLen > 0 ? remaining / segLen : 0;
          const px = Phaser.Math.Linear(poly[i].x, nextPt.x, ratio);
          const py = Phaser.Math.Linear(poly[i].y, nextPt.y, ratio);
          sketch.lineTo(px, py);
          remaining = 0;
        }
      }

      sketch.strokePath();
    }
  };

  const cleanup = (): void => {
    if (activeTween) {
      activeTween.stop();
      activeTween = null;
    }
    if (sketch.scene) {
      sketch.destroy();
    }
  };

  activeTween = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: drawDuration,
    ease: 'Sine.easeInOut',
    onUpdate: (tween) => {
      if (stopped || !target.scene) return;
      sketch.setPosition(target.x, target.y);
      sketch.setRotation(target.rotation);
      renderProgress(tween.getValue() ?? 0);
    },
    onComplete: () => {
      if (stopped || !target.scene) {
        cleanup();
        resolvePromise?.();
        return;
      }

      // Fade in the solid object while dissolving the sketch lines.
      activeTween = scene.tweens.add({
        targets: target,
        alpha: finalAlpha,
        duration: fillDuration,
        ease: 'Quad.easeOut',
        onUpdate: (tween) => {
          sketch.setAlpha(1 - tween.progress);
        },
        onComplete: () => {
          cleanup();
          onComplete?.();
          resolvePromise?.();
        },
      });
    },
  });

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cleanup();
      if (target.scene) {
        target.setAlpha(finalAlpha);
      }
      resolvePromise?.();
    },
    promise,
  };
}

/**
 * Smoothly fades an object out, optionally shrinking and destroying it.
 */
export function fadeOut(
  scene: Phaser.Scene,
  target: AnimatableObject,
  options: FadeOutOptions = {},
): Phaser.Tweens.Tween {
  const {
    duration = 320,
    delay = 0,
    shrinkTo,
    destroyOnComplete = false,
    onComplete,
  } = options;

  const props: Phaser.Types.Tweens.TweenBuilderConfig = {
    targets: target,
    alpha: 0,
    duration,
    delay,
    ease: 'Quad.easeIn',
    onComplete: () => {
      if (destroyOnComplete && target.scene) {
        target.destroy();
      }
      onComplete?.();
    },
  };

  if (typeof shrinkTo === 'number') {
    props.scaleX = shrinkTo;
    props.scaleY = shrinkTo;
  }

  return scene.tweens.add(props);
}

/**
 * Gentle breathing pulse to invite touch or click without adding UI clutter.
 */
export function pulseHint(
  scene: Phaser.Scene,
  target: AnimatableObject,
  options: PulseHintOptions = {},
): PulseHintHandle {
  const { scaleFactor = 1.07, minAlpha = 0.86, duration = 850 } = options;

  const baseScaleX = target.scaleX > 0.05 ? target.scaleX : 1;
  const baseScaleY = target.scaleY > 0.05 ? target.scaleY : 1;
  const baseAlpha = target.alpha > 0.05 ? target.alpha : 1;

  target.setScale(baseScaleX, baseScaleY);
  target.setAlpha(baseAlpha);

  const tween = scene.tweens.add({
    targets: target,
    scaleX: baseScaleX * scaleFactor,
    scaleY: baseScaleY * scaleFactor,
    alpha: minAlpha,
    duration,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const stop = (): void => {
    tween.stop();
    if (target.scene) {
      scene.tweens.add({
        targets: target,
        scaleX: baseScaleX,
        scaleY: baseScaleY,
        alpha: baseAlpha,
        duration: 160,
        ease: 'Quad.easeOut',
      });
    }
  };

  return { tween, stop };
}
