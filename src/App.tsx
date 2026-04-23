/**
 * MoCapAnything V2 — React TypeScript
 *
 * VideoPlayer layout:
 *   - Top:    main video player (full width)
 *   - Bottom: horizontal scrollable thumbnail strip
 *             active thumb = scaled up + full opacity
 *             inactive thumbs = scaled down + dimmed
 */

import { FC, ReactNode, useRef, useState, useEffect, useCallback } from "react";
import "./App.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoClip {
  src: string;
  caption: string;
}

// ---------------------------------------------------------------------------
// Global active-player registry
// ---------------------------------------------------------------------------

type PauseFn = () => void;
const activePlayers = new Set<PauseFn>();

function registerPlayer(pause: PauseFn) {
  activePlayers.add(pause);
  return () => activePlayers.delete(pause);
}

function pauseAllExcept(pause: PauseFn) {
  activePlayers.forEach((fn) => { if (fn !== pause) fn(); });
}

// ---------------------------------------------------------------------------
// VideoPlayer
// ---------------------------------------------------------------------------

interface VideoPlayerProps {
  clips: VideoClip[];
  title?: string;
}

const VideoPlayer: FC<VideoPlayerProps> = ({ clips, title }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const pauseSelf = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  // Only scroll thumbnails into view after the user has clicked — not on first mount
  const hasInteracted = useRef(false);

  useEffect(() => {
    return registerPlayer(pauseSelf);
  }, [pauseSelf]);

  // Set thumbnail srcs via JS on mount
  useEffect(() => {
    clips.forEach((clip, i) => {
      const el = thumbVideoRefs.current[i];
      if (el) { el.src = clip.src; el.load(); }
    });
  }, [clips]);

  // When activeIdx changes: set main src via JS and play if visible
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = clips[activeIdx].src;
    v.load();

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.top < window.innerHeight && rect.bottom > 0) {
      pauseAllExcept(pauseSelf);
      v.play().catch(() => {});
    }

    // Skip scrollIntoView on first render — only do it after user interaction
    if (hasInteracted.current) {
      thumbnailRefs.current[activeIdx]?.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "smooth",
      });
    }
  }, [activeIdx, clips, pauseSelf]);

  // Pause when scrolled out of view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) pauseSelf(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pauseSelf]);

  const handlePlay = () => pauseAllExcept(pauseSelf);
  const handleEnded = () => {
    hasInteracted.current = true;
    setActiveIdx((i) => (i + 1) % clips.length);
  };

  const handleSelect = (idx: number) => {
    hasInteracted.current = true;
    if (idx === activeIdx) {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) { pauseAllExcept(pauseSelf); v.play().catch(() => {}); }
      else v.pause();
    } else {
      setActiveIdx(idx);
    }
  };

  return (
    <div className="vp-wrapper" ref={containerRef}>
      {title && <p className="subsection-title" style={{ marginBottom: 12 }}>{title}</p>}

      {/* ── Main player (full width) ── */}
      <div className="vp-player-col">
        <video
          ref={videoRef}
          className="vp-main-video"
          controls
          playsInline
          onPlay={handlePlay}
          onEnded={handleEnded}
        />
        <p className="vp-main-caption">{clips[activeIdx].caption}</p>
      </div>

      {/* ── Thumbnail strip below ── */}
      <div className="vp-thumb-strip">
        {clips.map((clip, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={i}
              ref={(el) => { thumbnailRefs.current[i] = el; }}
              className={`vp-thumb-btn${isActive ? " active" : ""}`}
              onClick={() => handleSelect(i)}
              title={clip.caption}
            >
              <video
                ref={(el) => { thumbVideoRefs.current[i] = el; }}
                className="vp-thumb-video"
                preload="metadata"
                muted
                playsInline
              />
              <span className="vp-thumb-caption">{clip.caption}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const FriendlyDesc: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="friendly-desc">{children}</div>
);

const SubsectionTitle: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="subsection-title">{children}</p>
);

// ---------------------------------------------------------------------------
// StickyNav
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "#method",        label: "Method" },
  { href: "#demo",          label: "Demo" },
  { href: "#mocap-compare", label: "Per-Animal Mocap" },
  { href: "#one2many",      label: "One-to-Many" },
  { href: "#dance",         label: "Dance" },
];

const StickyNav: FC = () => (
  <nav className="sticky-nav has-text-centered">
    {NAV_LINKS.map((l) => (
      <a key={l.href} href={l.href}>{l.label}</a>
    ))}
  </nav>
);

// ---------------------------------------------------------------------------
// HeroSection
// ---------------------------------------------------------------------------

const HeroSection: FC = () => (
  <section className="hero">
    <div className="hero-body">
      <div className="container has-text-centered">
        <h1 className="title is-2">
          MoCapAnything V2: End-to-End Motion Capture with
          Animation-Ready Rotations for Arbitrary Skeletons
        </h1>
      </div>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// AuthorsSection
// ---------------------------------------------------------------------------

const AuthorsSection: FC = () => (
  <section className="section">
    <div className="container has-text-centered">
      <h2 className="title is-4">Authors</h2>
      <p style={{ fontSize: "0.9rem", marginTop: 8 }}>
        <sup>*</sup>Equal Contributions &nbsp;&nbsp;
        <sup>†</sup>Corresponding Author
      </p>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// AbstractSection
// ---------------------------------------------------------------------------

const AbstractSection: FC = () => (
  <section className="section">
    <div className="container">
      <h2 className="title is-3 has-text-centered">Abstract</h2>
      <div className="content has-text-justified">
        <p>
          Recovering 3D character animation from monocular video is a fundamental problem in
          computer vision and graphics. Existing methods typically predict joint positions from
          video and then recover joint rotations via analytical inverse kinematics (IK). This
          pipeline is fundamentally limited: IK relies on purely geometric constraints and
          cannot recover under-constrained degrees of freedom such as bone-axis twist, and the
          position-to-rotation mapping is inherently ill-posed once the target skeleton's
          coordinate conventions are unknown.
        </p>
        <p>
          We present a reference-conditioned end-to-end framework that reformulates rotation
          recovery from a geometry-solving procedure into a learnable, reference-conditioned
          modeling problem. A single reference pose–rotation pair from the target asset —
          naturally available whenever a rigged skeleton is provided — serves as an explicit
          coordinate-system anchor, turning an ill-posed mapping into a well-constrained
          conditional prediction task. A learned rotation decoder replaces analytical IK, and
          a Global-Local Graph-guided Multi-Head Attention (GL-GMHA) module alternates between
          kinematic-chain-local and skeleton-global reasoning. We further show that joint
          positions — not mesh — serve as the right skeleton-shared canonical intermediate for
          cross-skeleton generalization, since predicted-mesh errors compound through the
          pipeline at inference time.
        </p>
        <p>
          Across Truebones Zoo and Objaverse benchmarks spanning seen, rare, and unseen
          skeletons, our method reduces the average rotation angle error from ~17° (traditional
          IK) to ~10°, and from 23°–25° down to 6.68° on unseen skeletons specifically, while
          being ~40× faster at inference than mesh-based pipelines.
        </p>
      </div>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// MethodSection
// ---------------------------------------------------------------------------

const MethodSection: FC = () => (
  <section id="method" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">Method</h2>
      <img
        style={{ width: "80%" }}
        src="assets/MoCapAnything_framework.png"
        alt="MoCapAnything Framework"
      />
      <p><i>Figure: Overview of our modular pipeline.</i></p>
      <FriendlyDesc>
        A multi-modal Reference Prompt Encoder fuses mesh, skeleton, and appearance of the
        target asset into per-joint queries. A monocular video is converted into a 4D mesh
        sequence. The Unified Motion Decoder fuses these signals via multi-branch attention to
        predict 3D keypoints, converted to asset-specific joint rotations via an
        optimization-based IK layer.
      </FriendlyDesc>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// DemoSection
// ---------------------------------------------------------------------------

const DemoSection: FC = () => (
  <section id="demo" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">1. Overview Demo</h2>
      <FriendlyDesc>
        A quick overview of MoCapAnything across zoo animals, Objaverse assets, and
        in-the-wild videos.
      </FriendlyDesc>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        style={{ width: "80%", margin: "0 auto 20px auto", display: "block" }}
      >
        <source src="assets/outputs_demo/mocap_demo_v1/v1/demo.mp4" type="video/mp4" />
      </video>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// PerAnimalSection
// ---------------------------------------------------------------------------

const PER_ANIMAL_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_compare_v2/v2/Bird_BIRD-Lander_y30.mp4",       caption: "Bird — Lander" },
  { src: "assets/outputs_demo/mocap_compare_v2/v2/KingCobra_Cobra-Attack_y15.mp4", caption: "King Cobra — Attack" },
];

const PerAnimalSection: FC = () => (
  <section id="mocap-compare" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">2. Per-Animal Mocap Results</h2>
      <FriendlyDesc>
        Representative results across species groups — quadrupeds, birds, reptiles, dinosaurs,
        and aquatic creatures.
      </FriendlyDesc>
      <VideoPlayer clips={PER_ANIMAL_CLIPS} />
      <FriendlyDesc>
        Our method demonstrates robust mocap abilities across a wide variety of species —
        flying, running, swimming; bipeds, quadrupeds, multi-leg creatures, and even limbless
        skeletons.
      </FriendlyDesc>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// OneToManySection
// ---------------------------------------------------------------------------

const ZOO_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Hamster_Hamster-RollAttack_y60.mp4",   caption: "Hamster — Roll Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Pteranodon_Pteranodon-Fancy_y30.mp4", caption: "Pteranodon — Fancy" },
];

const OBJ_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_6babbd9f-307b-5db5-aabc-35196095cbaa_6babbd9f-307b-5db5-aabc-35196095cbaa_y15.mp4", caption: "Objaverse #01" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_97e2fc5c-50e4-5199-8632-99fa7160b126_97e2fc5c-50e4-5199-8632-99fa7160b126_y30.mp4", caption: "Objaverse #02" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_0a763d17-417d-5473-a41a-7d1a796544d2_0a763d17-417d-5473-a41a-7d1a796544d2_y0.mp4",  caption: "Objaverse #03" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_22160d82-24bc-573c-922e-da11786b5ea2_22160d82-24bc-573c-922e-da11786b5ea2_y45.mp4", caption: "Objaverse #04" },
];

const WILD_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",    caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4", caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",    caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4", caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",    caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4", caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",    caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4", caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",    caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4", caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",    caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4", caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",    caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4", caption: "Eagle" },
];

const OneToManySection: FC = () => (
  <section id="one2many" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">3. One-to-Many: Cross-Asset Mocap</h2>
      <FriendlyDesc>
        Given a single input video, our method drives many different skeleton assets
        simultaneously — spanning Truebones Zoo animals, Objaverse creatures, and in-the-wild
        footage.
      </FriendlyDesc>
      <VideoPlayer clips={ZOO_CLIPS}  title="Truebones Zoo Animals" />
      <VideoPlayer clips={OBJ_CLIPS}  title="Objaverse Assets" />
      <VideoPlayer clips={WILD_CLIPS} title="In-the-Wild Videos" />
      <FriendlyDesc>
        Our method generalizes to in-the-wild footage covering every kind of species — flying,
        running, swimming; bipeds, quadrupeds, multi-leg creatures, and even limbless skeletons.
      </FriendlyDesc>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// DanceSection
// ---------------------------------------------------------------------------

const DANCE_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/dance_demo_v3/v3/eva_jiesuan.mp4", caption: "eva jiesuan" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/gufeng2.mp4",     caption: "gufeng 2" },
];

const DanceSection: FC = () => (
  <section id="dance" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">4. Dance &amp; Expressive Motion</h2>
      <FriendlyDesc>
        MoCapAnything applied to expressive dance sequences — from classical Chinese dance to
        pop — driven onto zoo animals and human skeletons. The model was never explicitly
        trained on dance data.
      </FriendlyDesc>
      <VideoPlayer clips={DANCE_CLIPS} />
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// CitationSection
// ---------------------------------------------------------------------------

const BIBTEX = `Placeholder`;

const CitationSection: FC = () => (
  <section className="section">
    <div className="container has-text-centered">
      <h2 className="title is-4">Citation</h2>
      <p className="friendly-desc" style={{ textAlign: "center", width: "60%", marginTop: 15 }}>
        If you find our work useful, please cite:
      </p>
      <pre style={{
        textAlign: "left",
        width: "70%",
        margin: "0 auto",
        background: "#f7f7f7",
        padding: 15,
        borderRadius: 8,
        fontSize: "0.9rem",
        whiteSpace: "pre-wrap",
      }}>
        {BIBTEX}
      </pre>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <div className="wrapper" style={{ width: "80%" }}>
      <HeroSection />
      <AuthorsSection />
      <AbstractSection />
      <StickyNav />
      <MethodSection />
      <DemoSection />
      <PerAnimalSection />
      <OneToManySection />
      <DanceSection />
      <CitationSection />
    </div>
  );
}