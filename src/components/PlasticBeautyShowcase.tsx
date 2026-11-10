import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Sparkles
} from 'lucide-react';
import { ProcedureImageItem, UserAccount } from '../types';
import { playSound } from '../utils/audioUtils';
import { getAllShowcasePhotos } from '../utils/database';

export type { ProcedureImageItem };

interface PlasticBeautyShowcaseProps {
  currentUser: UserAccount | null;
  onOpenLogin: () => void;
  onOpenWorkstation: () => void;
}

// ==========================================
// 1. FLOWING BUBBLES CANVAS (Behind the cards)
// ==========================================
interface Bubble {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  swaySpeed: number;
  swayDist: number;
  phase: number;
  hue: number;
  alpha: number;
  wobble: number;
}

const FlowingBubblesCanvas: React.FC<{ mousePos: { x: number; y: number } }> = ({ mousePos }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Initialize 36 glowing liquid/glass bubbles with slow, serene base speeds
    const bubbles: Bubble[] = Array.from({ length: 36 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 8 + Math.random() * 32,
      speedY: 0.12 + Math.random() * 0.26, // Calmer, slower float
      swaySpeed: 0.004 + Math.random() * 0.010,
      swayDist: 12 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      hue: 280 + Math.random() * 50, // Lavender, rose, pearlescent violet
      alpha: 0.20 + Math.random() * 0.35,
      wobble: Math.random() * Math.PI * 2,
    }));

    let prevMouseX = mousePos.x;
    let prevMouseY = mousePos.y;
    let speedMultiplier = 1.0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Track cursor movement: when cursor moves, gracefully decelerate the bubbles into slow-motion
      const mouseDistMoved = Math.hypot(mousePos.x - prevMouseX, mousePos.y - prevMouseY);
      prevMouseX = mousePos.x;
      prevMouseY = mousePos.y;

      let targetSpeed = 1.0;
      if (mouseDistMoved > 0.8 && mousePos.x > 0 && mousePos.y > 0) {
        // Slow down bubbles significantly as cursor moves across the background
        targetSpeed = Math.max(0.12, 1.0 - Math.min(mouseDistMoved * 0.05, 0.88));
      }
      speedMultiplier += (targetSpeed - speedMultiplier) * 0.08;

      for (const b of bubbles) {
        b.phase += b.swaySpeed * speedMultiplier;
        b.wobble += 0.015 * speedMultiplier;
        b.y -= b.speedY * speedMultiplier;

        let curX = b.x + Math.sin(b.phase) * b.swayDist;
        let curY = b.y;

        // Fluid repulsion from mouse / gel cursor
        if (mousePos.x > 0 && mousePos.y > 0) {
          const dx = curX - mousePos.x;
          const dy = curY - mousePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130 && dist > 0) {
            const force = (130 - dist) / 130;
            curX += (dx / dist) * force * 35;
            curY += (dy / dist) * force * 35;
          }
        }

        // Wrap around bottom
        if (b.y < -b.radius * 2) {
          b.y = height + b.radius * 2;
          b.x = Math.random() * width;
        }

        const r = b.radius + Math.sin(b.wobble) * 1.4;

        ctx.save();
        ctx.beginPath();
        ctx.arc(curX, curY, Math.max(1, r), 0, Math.PI * 2);

        // Translucent liquid radial gradient with iridescent edges
        const grad = ctx.createRadialGradient(
          curX - r * 0.3,
          curY - r * 0.3,
          r * 0.05,
          curX,
          curY,
          r
        );
        grad.addColorStop(0, `hsla(${b.hue}, 85%, 98%, ${b.alpha * 0.85})`);
        grad.addColorStop(0.4, `hsla(${b.hue}, 60%, 88%, ${b.alpha * 0.35})`);
        grad.addColorStop(0.85, `hsla(${b.hue + 25}, 80%, 78%, ${b.alpha * 0.55})`);
        grad.addColorStop(1, `hsla(${b.hue}, 75%, 72%, ${b.alpha * 0.75})`);
        ctx.fillStyle = grad;
        ctx.fill();

        // Delicate outer rim stroke
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = `hsla(${b.hue}, 75%, 82%, ${b.alpha * 0.8})`;
        ctx.stroke();

        // 3D Specular highlight crescent
        ctx.beginPath();
        ctx.ellipse(
          curX - r * 0.32,
          curY - r * 0.32,
          Math.max(1, r * 0.28),
          Math.max(1, r * 0.16),
          -Math.PI / 4,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * 0.95})`;
        ctx.fill();

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mousePos]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 w-full h-full"
    />
  );
};

// ==========================================
// 2. FLOWING GEL CURSOR CANVAS (Trail effect)
// ==========================================
interface GelNode {
  x: number;
  y: number;
  r: number;
}

const FlowingGelCursorCanvas: React.FC<{
  mousePos: { x: number; y: number };
  isTouchingImage: boolean;
  isInside: boolean;
}> = ({ mousePos, isTouchingImage, isInside }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const nodesRef = useRef<GelNode[]>([
    { x: -100, y: -100, r: 16 }, // lead droplet
    { x: -100, y: -100, r: 13 },
    { x: -100, y: -100, r: 10 },
    { x: -100, y: -100, r: 7.5 },
    { x: -100, y: -100, r: 5 },
    { x: -100, y: -100, r: 3 },
  ]);

  const sparklesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    let pulseTime = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (isInside && mousePos.x > 0 && mousePos.y > 0) {
        pulseTime += 0.05;
        const nodes = nodesRef.current;

        // Viscoelastic spring physics: lead node follows mouse
        const targetX = mousePos.x;
        const targetY = mousePos.y;

        nodes[0].x += (targetX - nodes[0].x) * 0.38;
        nodes[0].y += (targetY - nodes[0].y) * 0.38;

        // Trailing viscoelastic nodes follow predecessors
        for (let i = 1; i < nodes.length; i++) {
          const prev = nodes[i - 1];
          const curr = nodes[i];
          const spring = 0.30 - i * 0.035;
          curr.x += (prev.x - curr.x) * spring;
          curr.y += (prev.y - curr.y) * spring;
        }

        // Spawn cosmetic micro-sparkles when touching an image
        if (isTouchingImage && Math.random() < 0.4) {
          sparklesRef.current.push({
            x: nodes[0].x + (Math.random() - 0.5) * 24,
            y: nodes[0].y + (Math.random() - 0.5) * 24,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -0.6 - Math.random() * 1.2,
            life: 1,
            maxLife: 25 + Math.random() * 20,
          });
        }

        // Draw gel contact aura when touching an image
        if (isTouchingImage) {
          const auraRadius = 32 + Math.sin(pulseTime * 5) * 6;
          const auraGrad = ctx.createRadialGradient(
            nodes[0].x,
            nodes[0].y,
            nodes[0].r * 0.5,
            nodes[0].x,
            nodes[0].y,
            auraRadius
          );
          auraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.45)');
          auraGrad.addColorStop(0.6, 'rgba(236, 72, 153, 0.25)');
          auraGrad.addColorStop(1, 'rgba(200, 237, 53, 0)');
          ctx.beginPath();
          ctx.arc(nodes[0].x, nodes[0].y, auraRadius, 0, Math.PI * 2);
          ctx.fillStyle = auraGrad;
          ctx.fill();
        }

        // Draw the fluid viscoelastic gel body connecting nodes
        ctx.save();
        ctx.beginPath();
        // Path connecting nodes
        for (let i = 0; i < nodes.length; i++) {
          const p = nodes[i];
          const r = p.r * (isTouchingImage ? 1.25 : 1.0);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);

          // Liquid cosmetic gel gradient (clear, lavender, rose iridescence)
          const gelGrad = ctx.createRadialGradient(
            p.x - r * 0.35,
            p.y - r * 0.35,
            r * 0.1,
            p.x,
            p.y,
            r
          );
          if (isTouchingImage) {
            gelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            gelGrad.addColorStop(0.35, 'rgba(232, 185, 255, 0.85)');
            gelGrad.addColorStop(0.75, 'rgba(244, 114, 182, 0.65)');
            gelGrad.addColorStop(1, 'rgba(168, 85, 247, 0.85)');
          } else {
            gelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.90)');
            gelGrad.addColorStop(0.4, 'rgba(235, 215, 255, 0.70)');
            gelGrad.addColorStop(0.8, 'rgba(216, 180, 254, 0.55)');
            gelGrad.addColorStop(1, 'rgba(192, 132, 252, 0.75)');
          }
          ctx.fillStyle = gelGrad;
          ctx.shadowColor = isTouchingImage ? 'rgba(168, 85, 247, 0.6)' : 'rgba(192, 132, 252, 0.4)';
          ctx.shadowBlur = 10;
          ctx.fill();

          // 3D Specular highlight crescent
          ctx.beginPath();
          ctx.ellipse(
            p.x - r * 0.32,
            p.y - r * 0.32,
            r * 0.35,
            r * 0.20,
            -Math.PI / 4,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.shadowBlur = 0;
          ctx.fill();
        }
        ctx.restore();

        // Render micro-sparkles
        for (let i = sparklesRef.current.length - 1; i >= 0; i--) {
          const s = sparklesRef.current[i];
          s.x += s.vx;
          s.y += s.vy;
          s.life++;
          const progress = s.life / s.maxLife;
          const alpha = 1 - progress;

          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.8 * (1 - progress * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(240, 215, 255, ${alpha * 0.9})`;
          ctx.shadowColor = 'rgba(216, 180, 254, 0.8)';
          ctx.shadowBlur = 6;
          ctx.fill();

          if (s.life >= s.maxLife) {
            sparklesRef.current.splice(i, 1);
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mousePos, isTouchingImage, isInside]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
};

// ==========================================
// 3. MAIN COMPONENT
// ==========================================
export const PlasticBeautyShowcase: React.FC<PlasticBeautyShowcaseProps> = ({
  currentUser,
  onOpenLogin,
  onOpenWorkstation,
}) => {
  const categories = ['Botox', 'Rhinoplasty', 'Breast augmentation', 'Liposuction'] as const;
  const [activeCategory, setActiveCategory] = useState<string>('Botox');
  const [activeIndex, setActiveIndex] = useState(0);

  // Photos state loaded from IndexedDB and server backup
  const [items, setItems] = useState<ProcedureImageItem[]>([]);

  // Track toggled Before/After state per slide ID (manual latch/click)
  const [toggledStates, setToggledStates] = useState<Record<string, 'before' | 'after'>>({});

  // Card hover detection: whenever cursor with gel touches the image, switch to After view!
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // Cursor coordinates for the flowing gel and bubbles
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isMouseInside, setIsMouseInside] = useState(false);

  // Load photos persistently on mount
  useEffect(() => {
    let active = true;
    async function loadStoredPhotos() {
      try {
        const stored = await getAllShowcasePhotos();
        if (active) {
          setItems(stored);
        }
      } catch (err) {
        console.error('Error loading photos from database:', err);
      }
    }
    loadStoredPhotos();
    return () => {
      active = false;
    };
  }, []);

  // Filter items for active tab
  const tabItems = items.filter((item) => item.category === activeCategory);

  // Reset index when changing category
  useEffect(() => {
    setActiveIndex(0);
    setHoveredCardId(null);
  }, [activeCategory]);

  const handleNext = () => {
    playSound('click');
    if (tabItems.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % tabItems.length);
  };

  const handlePrev = () => {
    playSound('click');
    if (tabItems.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + tabItems.length) % tabItems.length);
  };

  const toggleBeforeAfter = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound('click');
    setToggledStates((prev) => {
      const current = prev[id] || 'before';
      return {
        ...prev,
        [id]: current === 'before' ? 'after' : 'before',
      };
    });
  };

  // Mouse & touch handlers for the flowing gel cursor
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsMouseInside(true);
  };

  const handleMouseLeave = () => {
    setIsMouseInside(false);
    setHoveredCardId(null);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top,
    });
    setIsMouseInside(true);
  };

  const currentItem = tabItems[activeIndex] || null;
  const isTouchingAnyImage = hoveredCardId !== null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setHoveredCardId(null)}
      className="relative min-h-[92vh] w-full bg-[#fcfaf7] border border-slate-200/70 rounded-3xl overflow-hidden p-6 sm:p-12 text-slate-900 shadow-xs font-sans select-none flex flex-col justify-between cursor-default"
    >
      {/* 1. FLOWING BUBBLES BACKGROUND BEHIND CARDS */}
      <FlowingBubblesCanvas mousePos={mousePos} />

      {/* 2. FLOWING VISCOELASTIC GEL CURSOR OVERLAY */}
      <FlowingGelCursorCanvas
        mousePos={mousePos}
        isTouchingImage={isTouchingAnyImage}
        isInside={isMouseInside}
      />

      {/* Subtle floating background ambient bokeh dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-14 left-20 w-3 h-3 rounded-full bg-purple-300/30 blur-[1px] animate-pulse" />
        <div className="absolute top-36 right-28 w-4 h-4 rounded-full bg-rose-300/25 blur-[1px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-24 left-1/3 w-3 h-3 rounded-full bg-purple-200/40 blur-[1px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-14 w-2.5 h-2.5 rounded-full bg-slate-300/30 blur-[1px]" />
      </div>

      <div className="relative z-10">
        {/* Top Header Row: "Plastic beauty" & "Get started" / Account (Upload photos and Photos saved removed as requested) */}
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-serif">
              Plastic beauty
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenWorkstation}
                  className="px-4 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Workstation
                </button>
                <button
                  onClick={onOpenLogin}
                  className="w-8 h-8 rounded-full border border-slate-300 hover:border-slate-800 bg-white text-slate-900 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  title={`${currentUser.name} (${currentUser.role})`}
                >
                  {currentUser.avatar}
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-5 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Get started
              </button>
            )}
          </div>
        </div>

        {/* Headline & Subtitle matching the video exactly */}
        <div className="text-left max-w-3xl pt-2 pb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal font-serif text-slate-950 tracking-tight leading-[1.08]">
            Attaining Beauty:
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-normal mt-3 max-w-2xl leading-relaxed">
            A sociological study of elective cosmetic procedure in Kerala
          </p>
        </div>

        {/* Category Pills matching the video */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none text-xs sm:text-sm">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  playSound('click');
                }}
                className={`px-4 sm:px-5 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-950 text-white font-semibold shadow-sm'
                    : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* 3D Coverflow Carousel Container */}
        <div className="relative my-6 sm:my-8 h-[340px] sm:h-[420px] flex items-center justify-center overflow-hidden">
          {tabItems.length === 0 ? (
            /* Clean Empty State when no photos uploaded yet for this tab */
            <div className="w-[300px] sm:w-[380px] h-[300px] sm:h-[380px] rounded-3xl border-2 border-dashed border-slate-300 bg-white/70 p-8 flex flex-col items-center justify-center text-center space-y-3.5 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Camera size={24} />
              </div>
              <div>
                <h4 className="text-base font-serif font-bold text-slate-900">
                  No images for {activeCategory}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                  Procedure Before and After cases will appear here.
                </p>
              </div>
            </div>
          ) : (
            /* 3D Coverflow Carousel with uploaded images */
            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
              {tabItems.map((item, index) => {
                const offset = (index - activeIndex + tabItems.length) % tabItems.length;
                const isCenter = offset === 0;
                const isLeft = offset === tabItems.length - 1 || (tabItems.length === 2 && offset === 1);
                const isRight = offset === 1;

                if (!isCenter && !isLeft && !isRight) return null;

                // Whenever cursor with gel touches the image, automatically switch into AFTER image!
                const isTouchedByGel = hoveredCardId === item.id;
                const isAfter = isTouchedByGel || toggledStates[item.id] === 'after';

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => {
                      setHoveredCardId(item.id);
                      playSound('click');
                    }}
                    onMouseLeave={() => {
                      setHoveredCardId(null);
                    }}
                    onTouchStart={() => {
                      setHoveredCardId(item.id);
                    }}
                    onTouchEnd={() => {
                      setHoveredCardId(null);
                    }}
                    onClick={() => {
                      if (isCenter) {
                        toggleBeforeAfter(item.id);
                      } else if (isLeft) {
                        handlePrev();
                      } else if (isRight) {
                        handleNext();
                      }
                    }}
                    className={`absolute transition-all duration-500 ease-out cursor-pointer rounded-3xl overflow-hidden bg-slate-100 shadow-xl border group ${
                      isTouchedByGel
                        ? 'border-purple-400 ring-4 ring-purple-200/60 shadow-2xl scale-[1.02]'
                        : 'border-slate-200/80'
                    } ${
                      isCenter
                        ? 'z-30 w-[240px] sm:w-[320px] h-[300px] sm:h-[380px] scale-100 translate-x-0 opacity-100 shadow-2xl'
                        : isLeft
                        ? 'z-20 w-[200px] sm:w-[270px] h-[260px] sm:h-[330px] -translate-x-[60%] sm:-translate-x-[68%] scale-90 opacity-70 blur-[0.4px] hover:opacity-90'
                        : 'z-20 w-[200px] sm:w-[270px] h-[260px] sm:h-[330px] translate-x-[60%] sm:translate-x-[68%] scale-90 opacity-70 blur-[0.4px] hover:opacity-90'
                    }`}
                    style={{
                      transform: isCenter
                        ? isTouchedByGel
                          ? 'translateX(0) scale(1.02)'
                          : 'translateX(0) scale(1)'
                        : isLeft
                        ? 'translateX(-70%) scale(0.88) perspective(600px) rotateY(12deg)'
                        : 'translateX(70%) scale(0.88) perspective(600px) rotateY(-12deg)',
                    }}
                  >
                    {/* Before / After Dual Image Container with Smooth Cross-Fade */}
                    <div className="relative w-full h-full">
                      <img
                        src={item.beforeImage}
                        alt={`${item.title} - Before`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                          !isAfter ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                      />
                      <img
                        src={item.afterImage}
                        alt={`${item.title} - After`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                          isAfter ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                      />

                      {/* Gel touch active glow sheen */}
                      {isTouchedByGel && (
                        <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 via-transparent to-transparent pointer-events-none z-20 animate-pulse" />
                      )}
                    </div>

                    {/* Before / After Dynamic Status Pill Badge */}
                    <div className="absolute bottom-4 left-4 z-40">
                      <button
                        type="button"
                        onClick={(e) => toggleBeforeAfter(item.id, e)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center gap-1 ${
                          isAfter
                            ? 'bg-purple-600 text-white backdrop-blur-xs ring-2 ring-purple-300'
                            : 'bg-slate-900/80 text-white backdrop-blur-xs'
                        }`}
                      >
                        {isAfter && <Sparkles size={11} className="text-purple-200" />}
                        <span>{isAfter ? 'After' : 'Before'}</span>
                      </button>
                    </div>

                    {/* Notice: Delete button removed from cards as requested */}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Info Bar: Dot + Title on Left, Pagination & Nav Arrows on Right */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-200/70">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
            <span>{activeCategory}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
            <h3 className="text-xl sm:text-2xl font-serif text-slate-900 font-normal">
              {currentItem?.title || (tabItems.length === 0 ? 'No photos in this category' : activeCategory)}
            </h3>
          </div>
        </div>

        {/* Pagination & Arrows */}
        <div className="flex items-center gap-4 self-end sm:self-auto">
          {tabItems.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-20 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-300 rounded-full"
                  style={{
                    width: `${tabItems.length > 0 ? ((activeIndex + 1) / tabItems.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs font-mono text-slate-500 font-semibold tracking-wider">
                — {String(activeIndex + 1).padStart(2, '0')} / {String(tabItems.length).padStart(2, '0')} —
              </span>
            </div>
          )}

          {/* Navigation Arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={tabItems.length <= 1}
              className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 transition-colors shadow-xs disabled:opacity-30 cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={handleNext}
              disabled={tabItems.length <= 1}
              className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 transition-colors shadow-xs disabled:opacity-30 cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
