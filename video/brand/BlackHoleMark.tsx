import React, { useEffect, useRef } from 'react';

/**
 * Channel mark: a black hole seen almost edge-on — shadow, thin photon ring,
 * the flat accretion disk crossing in front, and its gravitationally lensed far side
 * forming a halo around the shadow. Drawn procedurally with smooth gradients (no AI imagery).
 * Transparent outside the glow, so it can sit on any background.
 */
export const BlackHoleMark: React.FC<{
  size: number;
  /** Shadow radius as a fraction of size. */
  radius?: number;
}> = ({ size, radius = 0.17 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const S = size;
    const c = S / 2;
    const R = S * radius;
    ctx.clearRect(0, 0, S, S);

    /** Draw on an offscreen layer, dim the receding (right) side, add onto the main canvas. */
    const layer = (draw: (g: CanvasRenderingContext2D) => void, doppler = 0.5) => {
      const off = document.createElement('canvas');
      off.width = S;
      off.height = S;
      const g = off.getContext('2d');
      if (!g) return;
      draw(g);
      g.globalCompositeOperation = 'destination-in';
      const mask = g.createLinearGradient(c - R * 3.6, 0, c + R * 3.6, 0);
      mask.addColorStop(0, 'rgba(0,0,0,1)');
      mask.addColorStop(1, `rgba(0,0,0,${1 - doppler})`);
      g.fillStyle = mask;
      g.fillRect(0, 0, S, S);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(off, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    };

    /** Hot gas: white-gold at the inner edge → orange → transparent. */
    const gasStops = (grad: CanvasGradient, inner: number, outer: number, peak: number) => {
      const span = outer - inner;
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(inner, 'rgba(0,0,0,0)');
      grad.addColorStop(inner + span * 0.03, `rgba(255,246,225,${peak})`);
      grad.addColorStop(inner + span * 0.22, `rgba(255,198,110,${peak * 0.8})`);
      grad.addColorStop(inner + span * 0.55, `rgba(240,120,40,${peak * 0.35})`);
      grad.addColorStop(1, 'rgba(160,50,10,0)');
    };

    // Soft glow.
    layer((g) => {
      const glow = g.createRadialGradient(c, c, R, c, c, R * 3.4);
      glow.addColorStop(0, 'rgba(255,170,80,0.35)');
      glow.addColorStop(1, 'rgba(255,110,30,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, S, S);
    }, 0.3);

    const squash = 0.17;
    const rIn = R * 1.5;
    const rOut = R * 3.6;
    const disk = (g: CanvasRenderingContext2D, front: boolean) => {
      g.save();
      g.translate(c, c);
      g.scale(1, squash);
      g.beginPath();
      g.rect(-S, front ? 0 : -S, 2 * S, S);
      g.clip();
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rOut);
      gasStops(grad, rIn / rOut, 1, 1);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, rOut, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };

    // Far half of the flat disk, then the lensed halo (far side bent over and under the shadow).
    layer((g) => disk(g, false), 0.55);
    layer((g) => {
      const outer = R * 1.95;
      const grad = g.createRadialGradient(c, c, 0, c, c, outer);
      gasStops(grad, (R * 1.02) / outer, 1, 0.95);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(c, c, outer, 0, Math.PI * 2);
      g.fill();
    }, 0.55);

    // Shadow.
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fill();

    // Photon ring.
    layer((g) => {
      g.strokeStyle = 'rgba(255,250,238,1)';
      g.lineWidth = Math.max(2, R * 0.04);
      g.shadowColor = 'rgba(255,225,170,1)';
      g.shadowBlur = R * 0.1;
      g.beginPath();
      g.arc(c, c, R * 1.035, 0, Math.PI * 2);
      g.stroke();
    }, 0.35);

    // Near half of the disk crosses in front of the shadow.
    layer((g) => disk(g, true), 0.55);
  }, [size, radius]);

  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, display: 'block' }} />;
};
