import { memo, useRef, type CSSProperties } from "react";
import { motion } from "framer-motion";

interface DraggableHeroDeckProps {
  draggableEnabled: boolean;
}

interface HeroDeckCard {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  stat: string;
  accent: string;
  positionClassName: string;
  rotation: number;
}

const HERO_DECK_CARDS: HeroDeckCard[] = [
  {
    id: "queue",
    eyebrow: "Realtime Queue",
    title: "Pull The Mix Forward",
    description: "Drag live modules around the hero to reshape the scene before you even hit play.",
    stat: "12 active lanes",
    accent: "rgba(255, 255, 255, 0.92)",
    positionClassName: "hero-drag-card-top-left",
    rotation: -9,
  },
  {
    id: "pulse",
    eyebrow: "Community Pulse",
    title: "Shared Signals",
    description: "Pinned drops, friend activity, and momentum markers now float as movable surfaces.",
    stat: "247 sync events",
    accent: "rgba(202, 255, 136, 0.92)",
    positionClassName: "hero-drag-card-top-right",
    rotation: 7,
  },
  {
    id: "depth",
    eyebrow: "Stereo Field",
    title: "Depth On Contact",
    description: "Each card carries its own glow, tilt, and tension so the hero feels tactile instead of static.",
    stat: "Spatial layer 3",
    accent: "rgba(140, 226, 255, 0.94)",
    positionClassName: "hero-drag-card-mid-left",
    rotation: -5,
  },
  {
    id: "discover",
    eyebrow: "Discovery Stack",
    title: "Throw New Finds Around",
    description: "Move recommendations like physical cards while the rest of the landing story keeps flowing.",
    stat: "84 fresh picks",
    accent: "rgba(255, 209, 102, 0.94)",
    positionClassName: "hero-drag-card-bottom-left",
    rotation: 8,
  },
  {
    id: "session",
    eyebrow: "Session Control",
    title: "Touch The Atmosphere",
    description: "Draggable details make the page feel more like an instrument than a poster.",
    stat: "Latency 4 ms",
    accent: "rgba(255, 161, 213, 0.94)",
    positionClassName: "hero-drag-card-bottom-right",
    rotation: -6,
  },
];

export const DraggableHeroDeck = memo(({ draggableEnabled }: DraggableHeroDeckProps) => {
  const constraintsRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="hero-drag-shell" data-interactive={draggableEnabled ? "true" : "false"}>
      <div className="hero-drag-shell-inner" ref={constraintsRef}>
        <div className="hero-drag-hint mn" aria-hidden="true">
          {draggableEnabled ? "DRAG THE LIVE MODULES" : "LIVE MODULES"}
        </div>

        {HERO_DECK_CARDS.map((card, index) => {
          const cardStyle = {
            "--hero-card-accent": card.accent,
          } as CSSProperties;

          return (
            <motion.article
              key={card.id}
              className={`hero-drag-card ${card.positionClassName}`}
              style={cardStyle}
              drag={draggableEnabled}
              dragConstraints={constraintsRef}
              dragElastic={0.14}
              dragMomentum={false}
              whileHover={draggableEnabled ? { scale: 1.02, y: -4 } : undefined}
              whileTap={draggableEnabled ? { scale: 0.985 } : undefined}
              whileDrag={
                draggableEnabled
                  ? {
                      scale: 1.04,
                      rotate: card.rotation + (card.rotation > 0 ? 2 : -2),
                      zIndex: 20,
                      boxShadow: "0 32px 70px rgba(0, 0, 0, 0.48)",
                    }
                  : undefined
              }
              initial={{ opacity: 0, y: 20, rotate: card.rotation }}
              animate={{ opacity: 1, y: 0, rotate: card.rotation }}
              transition={{
                delay: 0.08 * index,
                duration: 0.48,
                ease: [0.22, 1, 0.36, 1],
              }}
              aria-label={`${card.eyebrow}: ${card.title}`}
            >
              <div className="hero-drag-card-header">
                <span className="hero-drag-card-eyebrow mn">{card.eyebrow}</span>
                <span className="hero-drag-card-stat mn">{card.stat}</span>
              </div>
              <div className="hero-drag-card-body">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
});
