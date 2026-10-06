import { useId, useRef } from "react";
import type { DotStatus, Look } from "@/lib/types";

// 3D rendition of a dot character: spherical 3D lighting, plump 3D limbs, glossy dome eyes,
// rich material finishes (soft, glossy, velvet, toon), dimensional accessories, and ground contact shadow.

const BODY: Record<Look["shape"], { rx: number; ry: number }> = {
  round: { rx: 36, ry: 36 },
  chubby: { rx: 39.5, ry: 33.5 },
  tall: { rx: 33.5, ry: 39 },
};

function parseHex(hex: string): [number, number, number] {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return [180, 180, 180];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

function mix(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = parseHex(c1);
  const [r2, g2, b2] = parseHex(c2);
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

function shade(c: string, factor: number): string {
  const [r, g, b] = parseHex(c);
  if (factor >= 0) {
    return toHex([r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor]);
  }
  return toHex([r * (1 + factor), g * (1 + factor), b * (1 + factor)]);
}

export default function DotOrb({ look, status = "idle", size = 36 }: { look: Look; status?: DotStatus; size?: number }) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const sleeping = status === "paused";
  const { rx, ry } = BODY[look.shape] ?? BODY.round;
  const cy = 50;
  const top = cy - ry;
  const eyeY = cy - 8;
  const trim = look.accent === "#f4f4f4" ? "#d8195f" : look.accent;
  const eyeStyle = sleeping ? "closed" : look.eyes;
  const mat = look.material ?? "soft";

  // Dynamic 3D lighting palette for body based on material
  const bodyBase = look.color;
  const bodyKeyLight = mat === "glossy" ? shade(bodyBase, 0.75) : mat === "toon" ? shade(bodyBase, 0.55) : shade(bodyBase, 0.48);
  const bodyMidTone = mat === "glossy" ? shade(bodyBase, 0.22) : shade(bodyBase, 0.12);
  const bodyDarkShadow = mat === "glossy" ? mix(bodyBase, "#0d0914", 0.42) : mat === "toon" ? mix(bodyBase, "#0d0914", 0.38) : mix(bodyBase, "#120b1c", 0.35);
  const bodyRimBounce = mat === "velvet" ? shade(bodyBase, 0.35) : mix(bodyBase, "#ffffff", 0.18);

  // Plump feet 3D palette
  const feetBase = look.accent;
  const feetLight = shade(feetBase, 0.42);
  const feetShadow = mix(feetBase, "#0c0812", 0.45);

  // Render 3D glossy dome eyes
  const renderEye = (x: number, style: string) => {
    if (style === "happy") {
      return (
        <g key={x}>
          {/* Subtle soft depth under eye arch */}
          <path d={`M${x - 5.5} ${eyeY + 2.5} Q${x} ${eyeY - 6.5} ${x + 5.5} ${eyeY + 2.5}`} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={3.8} strokeLinecap="round" />
          <path d={`M${x - 5} ${eyeY + 2} Q${x} ${eyeY - 6} ${x + 5} ${eyeY + 2}`} fill="none" stroke="#16121e" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    }
    if (style === "closed") {
      return (
        <g key={x}>
          <path d={`M${x - 5.5} ${eyeY + 0.5} Q${x} ${eyeY + 5.5} ${x + 5.5} ${eyeY + 0.5}`} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={3.8} strokeLinecap="round" />
          <path d={`M${x - 5} ${eyeY} Q${x} ${eyeY + 5} ${x + 5} ${eyeY}`} fill="none" stroke="#16121e" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    }

    const w = style === "wide" ? 1.22 : 1;
    return (
      <g key={x}>
        {/* Soft shadow/cavity under 3D eye */}
        <ellipse cx={x} cy={eyeY + 0.8} rx={4.9 * w} ry={8.8} fill="rgba(0,0,0,0.22)" filter={`url(#softBlur${id})`} />
        {/* Deep rich glossy eyeball base */}
        <ellipse cx={x} cy={eyeY} rx={4.7 * w} ry={8.5} fill="#14101b" />
        {/* Colored lower iris glowing crescent */}
        <ellipse cx={x} cy={eyeY + 3.2} rx={3.9 * w} ry={4.7} fill={`url(#eyeGrad${id})`} />
        {/* Primary 3D specular highlight glint (curved bubble reflection) */}
        <ellipse cx={x - 1.2 * w} cy={eyeY - 3.4} rx={2.4 * w} ry={3.2} fill="#ffffff" opacity={0.95} />
        {/* Secondary micro glint */}
        <circle cx={x + 1.8 * w} cy={eyeY + 3.2} r={1.1} fill="#ffffff" opacity={0.8} />
      </g>
    );
  };

  return (
    <span
      className={`relative inline-block shrink-0 ${status === "working" ? "animate-[dot-bob_0.5s_ease-in-out_infinite]" : status === "waiting" ? "animate-[dot-bob_1.2s_ease-in-out_infinite]" : ""}`}
      style={{
        width: size,
        height: size,
        filter: sleeping ? "grayscale(0.4) brightness(0.96)" : undefined,
      }}
    >
      <svg
        ref={svg}
        viewBox="-4 -7 108 108"
        width={size}
        height={size}
        aria-hidden
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" || !svg.current) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - 0.5;
          const y = (event.clientY - bounds.top) / bounds.height - 0.5;
          svg.current.style.transform = `perspective(360px) translate3d(${x * 3.5}px, ${y * 3.5}px, 0) rotateX(${-y * 9}deg) rotateY(${x * 9}deg) scale3d(1.04, 1.04, 1.04)`;
        }}
        onPointerLeave={() => {
          if (svg.current) svg.current.style.transform = "";
        }}
        style={{
          transformOrigin: "center center",
          transition: "transform 140ms cubic-bezier(0.2, 0, 0, 1)",
          willChange: "transform",
        }}
      >
        <defs>
          {/* Soft blur filter for realistic ambient shadows */}
          <filter id={`softBlur${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <filter id={`haloGlow${id}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* 3D ground contact shadow */}
          <radialGradient id={`gShadow${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#000000" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* 3D spherical body gradient */}
          {mat === "toon" ? (
            <radialGradient id={`bGrad${id}`} cx="36%" cy="28%" r="72%">
              <stop offset="0%" stopColor={bodyKeyLight} />
              <stop offset="38%" stopColor={bodyKeyLight} />
              <stop offset="39%" stopColor={bodyBase} />
              <stop offset="74%" stopColor={bodyBase} />
              <stop offset="75%" stopColor={bodyDarkShadow} />
              <stop offset="100%" stopColor={bodyDarkShadow} />
            </radialGradient>
          ) : (
            <radialGradient id={`bGrad${id}`} cx="33%" cy="26%" r="76%">
              <stop offset="0%" stopColor={bodyKeyLight} />
              <stop offset="28%" stopColor={bodyMidTone} />
              <stop offset="62%" stopColor={bodyBase} />
              <stop offset="88%" stopColor={bodyDarkShadow} />
              <stop offset="100%" stopColor={bodyRimBounce} />
            </radialGradient>
          )}

          {/* 3D specular highlight on body head */}
          <radialGradient id={`bSpec${id}`} cx="35%" cy="30%" r="45%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={mat === "glossy" ? 0.95 : mat === "velvet" ? 0.35 : 0.65} />
            <stop offset="45%" stopColor="#ffffff" stopOpacity={mat === "glossy" ? 0.45 : mat === "velvet" ? 0.12 : 0.22} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Plump 3D feet gradient */}
          <radialGradient id={`fGradL${id}`} cx="40%" cy="25%" r="72%">
            <stop offset="0%" stopColor={feetLight} />
            <stop offset="55%" stopColor={feetBase} />
            <stop offset="92%" stopColor={feetShadow} />
            <stop offset="100%" stopColor={shade(feetBase, -0.6)} />
          </radialGradient>
          <radialGradient id={`fGradR${id}`} cx="40%" cy="25%" r="72%">
            <stop offset="0%" stopColor={feetLight} />
            <stop offset="55%" stopColor={feetBase} />
            <stop offset="92%" stopColor={feetShadow} />
            <stop offset="100%" stopColor={shade(feetBase, -0.6)} />
          </radialGradient>

          {/* 3D arm gradients */}
          <radialGradient id={`armGradL${id}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={bodyKeyLight} />
            <stop offset="58%" stopColor={bodyBase} />
            <stop offset="100%" stopColor={bodyDarkShadow} />
          </radialGradient>
          <radialGradient id={`armGradR${id}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={bodyKeyLight} />
            <stop offset="58%" stopColor={bodyBase} />
            <stop offset="100%" stopColor={bodyDarkShadow} />
          </radialGradient>

          {/* 3D glossy eye iris */}
          <radialGradient id={`eyeGrad${id}`} cx="50%" cy="70%" r="60%">
            <stop offset="0%" stopColor={shade(look.eyeColor, 0.45)} />
            <stop offset="55%" stopColor={look.eyeColor} />
            <stop offset="100%" stopColor={shade(look.eyeColor, -0.5)} />
          </radialGradient>

          {/* 3D soft cheek blush */}
          <radialGradient id={`blushGrad${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={mix(look.color, "#ff3b7b", 0.72)} stopOpacity="0.75" />
            <stop offset="60%" stopColor={mix(look.color, "#ff3b7b", 0.5)} stopOpacity="0.35" />
            <stop offset="100%" stopColor={look.color} stopOpacity="0" />
          </radialGradient>

          {/* 3D Cap gradients */}
          <radialGradient id={`capCrownGrad${id}`} cx="40%" cy="25%" r="75%">
            <stop offset="0%" stopColor={shade(trim, 0.4)} />
            <stop offset="55%" stopColor={trim} />
            <stop offset="100%" stopColor={shade(trim, -0.45)} />
          </radialGradient>
          <linearGradient id={`capVisorGrad${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={shade(trim, 0.25)} />
            <stop offset="45%" stopColor={trim} />
            <stop offset="100%" stopColor={shade(trim, -0.55)} />
          </linearGradient>

          {/* 3D Headphones gradients */}
          <linearGradient id={`headbandGrad${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a4254" />
            <stop offset="40%" stopColor="#2c2534" />
            <stop offset="100%" stopColor="#141019" />
          </linearGradient>
          <radialGradient id={`earcupGrad${id}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={shade(trim, 0.45)} />
            <stop offset="60%" stopColor={trim} />
            <stop offset="100%" stopColor={shade(trim, -0.5)} />
          </radialGradient>

          {/* 3D Golden Halo */}
          <linearGradient id={`haloGrad${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffea75" />
            <stop offset="30%" stopColor="#fff8b8" />
            <stop offset="70%" stopColor="#f5c016" />
            <stop offset="100%" stopColor="#d18a00" />
          </linearGradient>

          {/* 3D Sprout */}
          <radialGradient id={`sproutLeafGrad${id}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#8dec9c" />
            <stop offset="60%" stopColor="#4bb85a" />
            <stop offset="100%" stopColor="#256b30" />
          </radialGradient>

          {/* 3D Bow */}
          <radialGradient id={`bowGrad${id}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={shade(trim, 0.45)} />
            <stop offset="60%" stopColor={trim} />
            <stop offset="100%" stopColor={shade(trim, -0.4)} />
          </radialGradient>
        </defs>

        {/* 1. Ground contact shadow beneath the 3D puffball */}
        <ellipse cx={50} cy={cy + ry + 4.5} rx={rx * 0.9} ry={6.5} fill={`url(#gShadow${id})`} />

        {/* 2. Accessories rendered BEHIND body (Halo, Headphones headband, Antenna stem) */}
        {look.accessory === "halo" && (
          <g filter={`url(#haloGlow${id})`}>
            {/* 3D golden torus ring floating in 3D perspective */}
            <ellipse cx={50} cy={top - 7} rx={22} ry={6.5} fill="none" stroke={`url(#haloGrad${id})`} strokeWidth={4.2} />
            {/* Top specular glint on the halo */}
            <path d={`M 36 ${top - 9.5} Q 50 ${top - 12} 64 ${top - 9.5}`} fill="none" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
          </g>
        )}

        {look.accessory === "antenna" && (
          <g>
            {/* Metallic chrome stem */}
            <line x1={50} y1={top + 2} x2={50} y2={top - 13} stroke="#5e546a" strokeWidth={3} strokeLinecap="round" />
            <line x1={49.5} y1={top + 2} x2={49.5} y2={top - 13} stroke="#b0a8bd" strokeWidth={1.2} strokeLinecap="round" />
            {/* 3D glossy metallic orb at the tip */}
            <circle cx={50} cy={top - 15} r={5.2} fill={`url(#bowGrad${id})`} />
            <circle cx={48.4} cy={top - 16.6} r={1.6} fill="#ffffff" opacity={0.9} />
          </g>
        )}

        {look.accessory === "headphones" && (
          <g>
            {/* Thick 3D padded headband arching over top of the head */}
            <path d={`M${50 - rx + 3} ${cy - 8} A ${rx - 2} ${ry + 2} 0 0 1 ${50 + rx - 3} ${cy - 8}`} fill="none" stroke={`url(#headbandGrad${id})`} strokeWidth={5.5} strokeLinecap="round" />
            <path d={`M${50 - rx + 6} ${cy - 14} A ${rx - 4} ${ry} 0 0 1 ${50 + rx - 6} ${cy - 14}`} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1.4} strokeLinecap="round" />
          </g>
        )}

        {/* 3. Plump 3D Feet (rendered under the body, with contact and top highlights) */}
        {/* Left Foot */}
        <g>
          {/* Ambient shadow beneath foot */}
          <ellipse cx={33} cy={cy + ry + 2} rx={16} ry={5} fill="rgba(0,0,0,0.3)" filter={`url(#softBlur${id})`} />
          {/* Main 3D plump foot */}
          <ellipse cx={33} cy={cy + ry - 1} rx={16.5} ry={10} transform={`rotate(-10 33 ${cy + ry - 1})`} fill={`url(#fGradL${id})`} />
          {/* Foot top specular highlight curve */}
          <path d={`M 25 ${cy + ry - 5} Q 33 ${cy + ry - 8} 41 ${cy + ry - 5}`} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth={1.8} strokeLinecap="round" />
        </g>
        {/* Right Foot */}
        <g>
          {/* Ambient shadow beneath foot */}
          <ellipse cx={67} cy={cy + ry + 2} rx={16} ry={5} fill="rgba(0,0,0,0.3)" filter={`url(#softBlur${id})`} />
          {/* Main 3D plump foot */}
          <ellipse cx={67} cy={cy + ry - 1} rx={16.5} ry={10} transform={`rotate(10 67 ${cy + ry - 1})`} fill={`url(#fGradR${id})`} />
          {/* Foot top specular highlight curve */}
          <path d={`M 59 ${cy + ry - 5} Q 67 ${cy + ry - 8} 75 ${cy + ry - 5}`} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth={1.8} strokeLinecap="round" />
        </g>

        {/* 4. 3D Rounded Arms */}
        {/* Left Arm nub */}
        <g>
          <ellipse cx={50 - rx} cy={cy + 5} rx={10} ry={7.8} transform={`rotate(-25 ${50 - rx} ${cy + 5})`} fill={`url(#armGradL${id})`} />
          {/* Top highlight on left arm */}
          <circle cx={50 - rx - 1} cy={cy + 3} r={2.2} fill="rgba(255,255,255,0.35)" />
        </g>
        {/* Right Arm nub (waves if waiting) */}
        <g>
          <ellipse
            cx={50 + rx}
            cy={status === "waiting" ? cy - 16 : cy - 4}
            rx={10}
            ry={7.8}
            transform={`rotate(${status === "waiting" ? 45 : 35} ${50 + rx} ${status === "waiting" ? cy - 16 : cy - 4})`}
            fill={`url(#armGradR${id})`}
          />
          <circle
            cx={50 + rx + 1}
            cy={status === "waiting" ? cy - 18 : cy - 6}
            r={2.2}
            fill="rgba(255,255,255,0.35)"
          />
        </g>

        {/* 5. 3D Spherical Body */}
        <g>
          {/* Ambient contact shadow between body and feet/floor */}
          <ellipse cx={50} cy={cy + ry - 4} rx={rx * 0.72} ry={6} fill="rgba(0,0,0,0.25)" filter={`url(#softBlur${id})`} />
          {/* Primary 3D Sphere */}
          <ellipse cx={50} cy={cy} rx={rx} ry={ry} fill={`url(#bGrad${id})`} />
          {/* Keylight specular reflection highlight */}
          <ellipse cx={50 - rx * 0.32} cy={cy - ry * 0.32} rx={rx * 0.38} ry={ry * 0.28} transform={`rotate(-28 ${50 - rx * 0.32} ${cy - ry * 0.32})`} fill={`url(#bSpec${id})`} />
          {/* Extra crisp specular gleam for glossy materials */}
          {mat === "glossy" && (
            <ellipse cx={50 - rx * 0.38} cy={cy - ry * 0.38} rx={rx * 0.14} ry={ry * 0.08} transform={`rotate(-28 ${50 - rx * 0.38} ${cy - ry * 0.38})`} fill="#ffffff" opacity={0.9} />
          )}
          {/* Top perimeter rim sheen */}
          <path
            d={`M ${50 - rx * 0.65} ${cy - ry * 0.75} Q 50 ${cy - ry - 0.5} ${50 + rx * 0.65} ${cy - ry * 0.75}`}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>

        {/* 6. 3D Face Elements */}
        {/* Soft 3D spherical rosy cheeks (blush) */}
        <ellipse cx={32} cy={cy + 3.2} rx={6.5} ry={4} fill={`url(#blushGrad${id})`} />
        <ellipse cx={68} cy={cy + 3.2} rx={6.5} ry={4} fill={`url(#blushGrad${id})`} />

        {/* 3D Glossy Dome Eyes */}
        {renderEye(42.5, eyeStyle === "wink" ? "classic" : eyeStyle)}
        {renderEye(57.5, eyeStyle === "wink" ? "closed" : eyeStyle)}

        {/* 3D Smile mouth */}
        <path d={`M46.5 ${cy + 3} Q50 ${cy + 7.2} 53.5 ${cy + 3}`} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={3.4} strokeLinecap="round" />
        <path d={`M46.5 ${cy + 2.6} Q50 ${cy + 6.8} 53.5 ${cy + 2.6}`} fill="none" stroke="#1c1424" strokeWidth={2.4} strokeLinecap="round" />

        {/* 7. Accessories rendered IN FRONT of body (Cap, Headphones cups, Bow, Sprout) */}
        {/* 3D Baseball Cap */}
        {look.accessory === "cap" && (() => {
          const capY = cy - ry * 0.56;
          const half = rx * Math.sqrt(1 - ((capY - cy) / ry) ** 2) + 1.8;
          return (
            <g>
              {/* Visor drop shadow cast onto face and eyes */}
              <ellipse cx={50 + half * 0.35} cy={capY + 4} rx={half * 0.7} ry={4.5} fill="rgba(0,0,0,0.35)" filter={`url(#softBlur${id})`} />

              {/* 3D Crown wrapping around the head */}
              <path
                d={`M${50 - half} ${capY} A ${half} ${capY - top + 3} 0 0 1 ${50 + half} ${capY} Z`}
                fill={`url(#capCrownGrad${id})`}
              />
              {/* Crown top edge rim highlight */}
              <path
                d={`M${50 - half * 0.7} ${top + 1.5} Q 50 ${top - 1.2} ${50 + half * 0.7} ${top + 1.5}`}
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              {/* Crown curved front panel seam */}
              <path d={`M50 ${top - 2} Q 58 ${top + 4} ${60} ${capY}`} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={1.4} />

              {/* 3D Curved Visor / Bill projecting outward with 3D perspective */}
              <path
                d={`M${50 + half * 0.28} ${capY + 0.5} Q ${50 + half + 14} ${capY - 3.5} ${50 + half + 21} ${capY + 2.5} Q ${50 + half + 8} ${capY + 8} ${50 + half * 0.28} ${capY + 5.5} Z`}
                fill={`url(#capVisorGrad${id})`}
              />
              {/* Visor top sunlight rim reflection */}
              <path
                d={`M${50 + half * 0.35} ${capY + 0.8} Q ${50 + half + 14} ${capY - 3} ${50 + half + 20} ${capY + 2.5}`}
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />

              {/* 3D Button on top peak */}
              <circle cx={50} cy={top - 2.8} r={3.2} fill={shade(trim, -0.2)} />
              <circle cx={49.2} cy={top - 3.5} r={1.1} fill="#ffffff" opacity={0.8} />

              {/* Front circular eyelet / pin */}
              <circle cx={55} cy={capY - 5.5} r={2.8} fill="#ffffff" opacity={0.9} />
              <circle cx={55} cy={capY - 5.5} r={1.8} fill={trim} />
            </g>
          );
        })()}

        {/* 3D Headphones ear cushions & outer glossy cups */}
        {look.accessory === "headphones" && (
          <g>
            {/* Left earphone: inner dark cushion + outer 3D glossy cup */}
            <rect x={50 - rx - 5} y={cy - 17} width={6} height={17} rx={3} fill="#141019" />
            <rect x={50 - rx - 8} y={cy - 18} width={8} height={18} rx={4} fill={`url(#earcupGrad${id})`} />
            <ellipse cx={50 - rx - 4} cy={cy - 9} rx={2} ry={6} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />

            {/* Right earphone: inner dark cushion + outer 3D glossy cup */}
            <rect x={50 + rx - 1} y={cy - 17} width={6} height={17} rx={3} fill="#141019" />
            <rect x={50 + rx} y={cy - 18} width={8} height={18} rx={4} fill={`url(#earcupGrad${id})`} />
            <ellipse cx={50 + rx + 4} cy={cy - 9} rx={2} ry={6} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
          </g>
        )}

        {/* 3D Sprout */}
        {look.accessory === "sprout" && (
          <g>
            {/* 3D curved organic stem */}
            <path d={`M 50 ${top + 1} Q 50 ${top - 6} 47 ${top - 9}`} fill="none" stroke="#256b30" strokeWidth={3.4} strokeLinecap="round" />
            <path d={`M 50 ${top + 1} Q 50 ${top - 6} 47 ${top - 9}`} fill="none" stroke="#52c964" strokeWidth={1.8} strokeLinecap="round" />
            {/* Left 3D leaf */}
            <ellipse cx={41} cy={top - 10} rx={7.2} ry={4} transform={`rotate(25 41 ${top - 10})`} fill={`url(#sproutLeafGrad${id})`} />
            <path d={`M 45 ${top - 9} Q 41 ${top - 11} 36 ${top - 11}`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.2} />
            {/* Right 3D leaf */}
            <ellipse cx={54} cy={top - 11} rx={7.2} ry={4} transform={`rotate(-25 54 ${top - 11})`} fill={`url(#sproutLeafGrad${id})`} />
            <path d={`M 49 ${top - 10} Q 54 ${top - 12} 59 ${top - 12}`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.2} />
          </g>
        )}

        {/* 3D Bow */}
        {look.accessory === "bow" && (
          <g transform={`translate(65 ${top + 7}) rotate(-18)`}>
            {/* Left puffed ribbon wing */}
            <ellipse cx={-8} cy={0} rx={8.5} ry={6.2} fill={`url(#bowGrad${id})`} />
            <path d="M -13 -2 Q -8 -4 -3 -1" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.2} />
            {/* Right puffed ribbon wing */}
            <ellipse cx={8} cy={0} rx={8.5} ry={6.2} fill={`url(#bowGrad${id})`} />
            <path d="M 3 -1 Q 8 -4 13 -2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.2} />
            {/* Center 3D knot */}
            <circle cx={0} cy={0} r={4.2} fill={shade(trim, -0.2)} />
            <circle cx={-1.2} cy={-1.2} r={1.5} fill="#ffffff" opacity={0.8} />
          </g>
        )}
      </svg>
      {status === "waiting" && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-warning ring-2 ring-card shadow-sm" />}
    </span>
  );
}

