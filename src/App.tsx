/**
 * MoCapAnything V2 — React TypeScript
 *
 * VideoPlayer layout:
 *   - Top:    main video player (full width)
 *   - Bottom: horizontal scrollable thumbnail strip
 *             active thumb = scaled up + full opacity
 *             inactive thumbs = scaled down + dimmed
 */

import { type FC, type ReactNode, useRef, useState, useEffect, useCallback } from "react";
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
  splitLabels?: [string, string]; // [top, bottom] — renders vertical labels left of main video
  wide?: boolean;                  // true → 2.5:1 aspect (stacked V1/V2 comparison)
  ultrawide?: boolean;             // true → 5:1 aspect (horizontally concatenated multi-view)
}

const VideoPlayer: FC<VideoPlayerProps> = ({ clips, title, splitLabels, wide, ultrawide }) => {
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
    registerPlayer(pauseSelf);
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
        <div className={splitLabels ? "vp-split-row" : undefined}>
          {splitLabels && (
            <div className="vp-split-labels">
              <span>{splitLabels[0]}</span>
              <span>{splitLabels[1]}</span>
            </div>
          )}
          <video
            ref={videoRef}
            className={`vp-main-video${wide ? " wide" : ""}${ultrawide ? " ultrawide" : ""}${splitLabels ? " with-labels" : ""}`}
            controls
            playsInline
            onPlay={handlePlay}
            onEnded={handleEnded}
          />
        </div>
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

// const SubsectionTitle: FC<{ children: ReactNode }> = ({ children }) => (
//   <p className="subsection-title">{children}</p>
// );

// ---------------------------------------------------------------------------
// StickyNav
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "#video",         label: "Quick View" },
  { href: "#abstract",      label: "Abstract" },
  { href: "#method",        label: "Method" },
  { href: "#demo",          label: "MoCapAnything" },
  { href: "#dance",         label: "Dance Anything" },
  { href: "#one2many",      label: "Retarget Anything" },
  { href: "#mocap-compare", label: "V1 vs. V2 Results" },
];

const StickyNav: FC = () => (
  <nav className="sticky-nav has-text-centered">
    {NAV_LINKS.map((l) => (
      <a key={l.href} href={l.href}>{l.label}</a>
    ))}
  </nav>
);

const SideNav: FC = () => {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    NAV_LINKS.forEach((l) => {
      const el = document.getElementById(l.href.slice(1));
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="side-nav" aria-label="Section progress">
      {NAV_LINKS.map((l) => {
        const id = l.href.slice(1);
        const isActive = active === id;
        return (
          <a key={l.href} href={l.href} className={isActive ? "active" : ""}>
            <span className="dot" />
            <span className="label">{l.label}</span>
          </a>
        );
      })}
    </nav>
  );
};

// ---------------------------------------------------------------------------
// HeroSection
// ---------------------------------------------------------------------------

const HeroSection: FC = () => (
  <section className="hero">
    <div className="hero-body">
      <div className="container has-text-centered">
        <h1 className="title is-2">
          MoCapAnything V2: End-to-End Learning of Generalizable Motion
        </h1>
        <div className="buttons is-centered" style={{ marginTop: "1.5rem", gap: "0.75rem" }}>
          <a
            className="button is-dark is-rounded"
            href="#"
            aria-disabled="true"
            style={{ opacity: 0.55, pointerEvents: "none" }}
          >
            <span className="icon"><i className="fas fa-file-pdf" /></span>
            <span>Paper (arXiv)</span>
          </a>
          <a
            className="button is-dark is-rounded"
            href="#"
            aria-disabled="true"
            style={{ opacity: 0.55, pointerEvents: "none" }}
          >
            <span className="icon"><i className="fab fa-github" /></span>
            <span>Code</span>
          </a>
        </div>
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
// TeaserVideoSection
// ---------------------------------------------------------------------------

const TeaserVideoSection: FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  const pauseSelf = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  useEffect(() => {
    const cleanup = registerPlayer(pauseSelf);
    return () => { cleanup(); };
  }, [pauseSelf]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) pauseSelf(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pauseSelf]);

  const handleStart = (withSound: boolean) => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !withSound;
    pauseAllExcept(pauseSelf);
    v.play().catch(() => {});
    setStarted(true);
  };

  return (
    <section id="video" className="section">
      <div className="container has-text-centered">
        <h2 className="title is-4">90-Second Quick View (Best with 🔊 Sound on)</h2>
        <div
          ref={wrapperRef}
          style={{
            display: "inline-block",
            position: "relative",
            padding: "14px",
            background: "#0e0e0e",
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            maxWidth: "1280px",
            width: "100%",
          }}
        >
          <video
            ref={videoRef}
            style={{ display: "block", width: "100%", borderRadius: "6px" }}
            src="assets/outputs_demo/mocapv2_teaser.mp4"
            controls
            playsInline
            onPlay={() => pauseAllExcept(pauseSelf)}
          />
          {!started && (
            <div style={{
              position: "absolute",
              inset: "14px",
              borderRadius: "6px",
              background: "rgba(0,0,0,0.52)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "18px",
            }}>
              <button
                onClick={() => handleStart(true)}
                style={{
                  padding: "14px 32px",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, #3273dc, #2855b3)",
                  border: "none",
                  borderRadius: "999px",
                  cursor: "pointer",
                  boxShadow: "0 4px 18px rgba(50,115,220,0.45)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  letterSpacing: "0.02em",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                <span style={{ fontSize: "1.25rem" }}>🔊</span> Play with Sound
              </button>
              <button
                onClick={() => handleStart(false)}
                style={{
                  padding: "12px 28px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "#ddd",
                  background: "rgba(255,255,255,0.12)",
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  borderRadius: "999px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backdropFilter: "blur(6px)",
                  letterSpacing: "0.02em",
                  transition: "transform 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.22)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
              >
                <span style={{ fontSize: "1.1rem" }}>🔇</span> Play without Sound
              </button>
            </div>
          )}
        </div>
        <p style={{ fontSize: "0.95rem", color: "#666", marginTop: "1rem", fontStyle: "italic" }}>
          A 90-second overview. See the sections below for detailed comparisons and results.
        </p>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// AbstractSection
// ---------------------------------------------------------------------------

const AbstractSection: FC = () => (
  <section id="abstract" className="section">
    <div className="container">
      <h2 className="title is-3 has-text-centered">Abstract</h2>
      <div className="content has-text-justified">
        <p>
          Recent methods for arbitrary-skeleton motion capture from monocular video follow a
          factorized pipeline, where a Video-to-Pose network predicts joint positions and an
          analytical inverse-kinematics (IK) stage recovers joint rotations. While effective,
          this design is inherently limited, since joint positions do not fully determine
          rotations and leave degrees of freedom such as bone-axis twist ambiguous, and
          meanwhile the non-differentiable IK stage prevents the system from adapting to noisy
          predictions or optimizing for the final animation objective.
        </p>
        <p>
          In this work, we instead present the first <em>fully end-to-end</em> framework,
          where both Video-to-Pose and Pose-to-Rotation are learnable and jointly optimized.
          Crucially, we observe that the ambiguity in pose-to-rotation mapping arises from
          missing coordinate-system information, as the same joint positions can correspond to
          different rotations under different rest poses and local axis conventions, and to
          resolve this we introduce a reference pose–rotation pair from the target asset,
          which together with the rest pose not only anchors the mapping but also defines the
          underlying rotation coordinate system. This turns rotation prediction into a
          well-constrained conditional problem and enables effective learning.
        </p>
        <p>
          In addition, our model predicts joint positions directly from video without relying
          on mesh intermediates, which improves both robustness and efficiency, and both
          stages share a skeleton-aware Global-Local Graph-guided Multi-Head Attention
          (GL-GMHA) module for joint-level local reasoning and global coordination.
          Experiments on Truebones Zoo and Objaverse show that our method reduces rotation
          error from ~17° to ~10°, and to 6.54° on unseen skeletons, while achieving ~20×
          faster inference than mesh-based pipelines.
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

      <h3 id="overview" className="title is-4" style={{ marginTop: "2rem" }}>Overview</h3>
      <img
        style={{ width: "80%" }}
        src="assets/figure/teaser.png"
        alt="MoCapAnything V2 Overview"
      />
      <FriendlyDesc>
        Overview of MoCapAnything V2. Given an input video of a human or an animal, our
        method infers a topology-agnostic skeleton sequence across diverse skeleton
        topologies. Conditioned on a reference asset, the model predicts animation-ready
        rotations via an end-to-end framework, enabling the reference asset to perform
        the input motion.
      </FriendlyDesc>

      <h3 id="comparison" className="title is-4" style={{ marginTop: "3rem" }}>V1 vs V2</h3>
      <img
        style={{ width: "80%" }}
        src="assets/figure/difference_V1V2.png"
        alt="MoCapAnything V1 vs V2 Comparison"
      />
      <FriendlyDesc>
        Comparison of MoCapAnything V1 and V2. Unlike V1, which depends on mesh-conditioned
        video-to-pose estimation and analytical inverse kinematics (IK) for rotation
        recovery, V2 eliminates mesh conditioning and introduces a fully learnable
        Pose2Rot module. The entire pipeline is optimized end-to-end, enabling
        bidirectional coupling between pose and rotation for improved robustness and
        animation-ready motion synthesis.
      </FriendlyDesc>

      <h3 id="framework" className="title is-4" style={{ marginTop: "3rem" }}>Framework</h3>
      <img
        style={{ width: "80%" }}
        src="assets/figure/framework.png"
        alt="MoCapAnything Framework"
      />
      <FriendlyDesc>
        Framework of MoCapAnything V2. Our method unifies video-to-pose and pose-to-rotation
        within a single end-to-end trainable architecture. The video-to-pose stage consists of
        a reference-conditioned pose prompt encoder (A), which encodes skeleton and image cues
        into joint prompt, and a unified pose decoder (B), which predicts temporally coherent
        joint positions via cross-attention with video features. The pose-to-rotation stage is
        formulated as a learnable inverse kinematics module, composed of a rotation prompt
        encoder (C) that maps predicted poses into rot prompt, an anchor encoder (D) that
        encodes reference pose–rotation pairs to establish a consistent rotation coordinate
        space, and a unified rotation decoder (E) that generates animation-ready joint
        rotations conditioned on the anchor through cross-attention.
      </FriendlyDesc>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// DemoSection
// ---------------------------------------------------------------------------

const DEMO_ZOO_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_01_Hamster_Hamster-RollAttack_y60.mp4",  caption: "Hamster — Roll Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_02_Jaguar_Jaguar-Run_y60.mp4",           caption: "Jaguar — Run" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_03_Eagle_Eagle-Landing_y15.mp4",         caption: "Eagle — Landing" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_04_Dog-2_DOG-SwimIdle_y30.mp4",          caption: "Dog — Swim Idle" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_05_Horse_HorseALL-FeetUp_y30.mp4",       caption: "Horse — Feet Up" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_06_Ostrich_Ostrich-Attack3_y60.mp4",     caption: "Ostrich — Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_07_Chicken_Chicken-Walk_y60.mp4",        caption: "Chicken — Walk" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_08_Leapord_Leopard-Attack_y30.mp4",      caption: "Leopard — Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_09_Flamingo_Flamingo-BendIdle_y45.mp4",  caption: "Flamingo — Bend Idle" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_10_Goat_Goat-JumpKnock_y30.mp4",         caption: "Goat — Jump Knock" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_11_Crocodile_Crocodile-TailWhip_y60.mp4", caption: "Crocodile — Tail Whip" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_12_Goat_Goat-Attack_y30.mp4",            caption: "Goat — Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_13_Flamingo_Flamingo-Walk_y75.mp4",      caption: "Flamingo — Walk" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_14_Fox_run_y60.mp4",                     caption: "Fox — Run" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_15_Dragon_Wyvern-Attack_y30.mp4",        caption: "Wyvern — Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_16_Jaguar_Jaguar-Sit_y75.mp4",           caption: "Jaguar — Sit" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_17_Bird_BIRD-Attack3_y15.mp4",           caption: "Bird — Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_18_Goat_Goat-Run_y30.mp4",               caption: "Goat — Run" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_19_KingCobra_Cobra-Attack_y15.mp4",      caption: "King Cobra — Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_20_Raptor2_Raptor-Walk_y60.mp4",         caption: "Raptor — Walk" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_21_Coyote_Coyote-Attack2_y30.mp4",       caption: "Coyote — Attack" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_22_Pteranodon_Pteranodon-Fancy_y30.mp4", caption: "Pteranodon — Fancy" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_23_Lion_LionAll-Yawn_y60.mp4",           caption: "Lion — Yawn" },
  { src: "assets/outputs_demo/mocap_demo/zoo/zoo_24_Parrot_Parrot-CircleFly_y30.mp4",     caption: "Parrot — Circle Fly" },
];

const DEMO_WILD_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_demo/wild/wild_01_Eagle_Eagle_Act2.mp4",       caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_04_Jaguar_Jaguar_Act2.mp4",     caption: "Jaguar" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_03_Chicken_Chicken_Act2.mp4",   caption: "Chicken" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_12_Leapord_Leapord_Act4.mp4",   caption: "Leopard" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_02_Dog_Dog_Act2.mp4",           caption: "Dog #2" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_05_Parrot_Parrot_Act1.mp4",     caption: "Parrot" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_06_Bear_Bear_Act0.mp4",         caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_07_Tyranno_Tyranno_Act1.mp4",   caption: "Tyrannosaurus" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_08_Lion_Lion_Act1.mp4",         caption: "Lion #1" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_09_Buffalo_Buffalo-Act0.mp4",   caption: "Buffalo" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_10_Dog_Dog_Act1.mp4",           caption: "Dog #1" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_11_Camel_Camel-Act2.mp4",       caption: "Camel" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_13_Coyote_Coyote_Act1.mp4",     caption: "Coyote" },
  { src: "assets/outputs_demo/mocap_demo/wild/wild_14_Lion_Lion_Act2.mp4",         caption: "Lion #2" },
];

const DEMO_OBJ_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_demo/obj/obj_01_6babbd9f-307b-5db5-aabc-35196095cbaa_6babbd9f-307b-5db5-aabc-35196095cbaa_y15.mp4", caption: "Objaverse #01" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_02_0a763d17-417d-5473-a41a-7d1a796544d2_0a763d17-417d-5473-a41a-7d1a796544d2_y0.mp4",  caption: "Objaverse #02" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_03_97e2fc5c-50e4-5199-8632-99fa7160b126_97e2fc5c-50e4-5199-8632-99fa7160b126_y30.mp4", caption: "Objaverse #03" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_04_1a963917-a097-5856-b445-024ebabf7a78_1a963917-a097-5856-b445-024ebabf7a78_y45.mp4", caption: "Objaverse #04" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_05_22160d82-24bc-573c-922e-da11786b5ea2_22160d82-24bc-573c-922e-da11786b5ea2_y45.mp4", caption: "Objaverse #05" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_06_315eddf6-32b7-53e1-8106-c270c726dca8_315eddf6-32b7-53e1-8106-c270c726dca8_y0.mp4",  caption: "Objaverse #06" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_07_0df893d8-8774-5cc1-ac74-8111a1c0ae08_0df893d8-8774-5cc1-ac74-8111a1c0ae08_y30.mp4", caption: "Objaverse #07" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_08_2fcedbc3-d899-516b-b339-4f671945e329_2fcedbc3-d899-516b-b339-4f671945e329_y0.mp4",  caption: "Objaverse #08" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_09_12b981a9-d0ad-5abb-84ce-0ebffe25dd48_12b981a9-d0ad-5abb-84ce-0ebffe25dd48_y15.mp4", caption: "Objaverse #09" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_10_530a6b1a-5be2-5d3d-aa68-60ca61cb0974_530a6b1a-5be2-5d3d-aa68-60ca61cb0974_y0.mp4",  caption: "Objaverse #10" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_11_0698819d-b40e-555d-9ef4-139bbc839933_0698819d-b40e-555d-9ef4-139bbc839933_y60.mp4", caption: "Objaverse #11" },
  { src: "assets/outputs_demo/mocap_demo/obj/obj_12_a6d3cfe3-ac09-5a09-b902-0baf55e5533e_a6d3cfe3-ac09-5a09-b902-0baf55e5533e_y30.mp4", caption: "Objaverse #12" },
];

const DemoSection: FC = () => (
  <section id="demo" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">1. MoCapAnything Gallery</h2>
      <FriendlyDesc>
        A quick overview of MoCapAnything across zoo animals, Objaverse assets, and
        in-the-wild videos. Each clip shows 5 camera views side-by-side.
      </FriendlyDesc>
      <VideoPlayer clips={DEMO_ZOO_CLIPS}  title="Truebones Zoo Animals" ultrawide />
      <VideoPlayer clips={DEMO_OBJ_CLIPS}  title="Objaverse Assets" ultrawide />
      <VideoPlayer clips={DEMO_WILD_CLIPS} title="In-the-Wild Videos" ultrawide />
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// PerAnimalSection
// ---------------------------------------------------------------------------

const PER_ANIMAL_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_compare_v2/v2/Goat_Goat-Attack_y30.mp4",             caption: "Goat — Attack" },
  { src: "assets/outputs_demo/mocap_compare_v2/v2/Bird_BIRD-Lander_y30.mp4",             caption: "Bird — Lander" },
  { src: "assets/outputs_demo/mocap_compare_v2/v2/KingCobra_Cobra-Attack_y15.mp4",       caption: "King Cobra — Attack" },
  { src: "assets/outputs_demo/mocap_compare_v2/v2/Crocodile_Crocodile-TailWhip_y60.mp4", caption: "Crocodile — Tail Whip" },
  { src: "assets/outputs_demo/mocap_compare_v2/v2/Turtle_Turtle-Walk_y75.mp4",           caption: "Turtle — Walk" },
  { src: "assets/outputs_demo/mocap_compare_v2/v2/Leapord_Leopard-Attack_y30.mp4",       caption: "Leopard — Attack" },
];

const PerAnimalSection: FC = () => (
  <section id="mocap-compare" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">4. V1 vs. V2</h2>
      <FriendlyDesc>
        <b>MoCapAnything V1 vs. V2.</b> Row 1: V1 (traditional IK-based optimization).
        Row 2: V2 (our learning-based rotation recovery). V1 suffers from joint spinning
        artifacts, whereas V2 produces stable, temporally consistent rotations.
      </FriendlyDesc>
      <VideoPlayer clips={PER_ANIMAL_CLIPS} splitLabels={["V1", "V2"]} wide />
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// OneToManySection
// ---------------------------------------------------------------------------

const ZOO_CLIPS: VideoClip[] = [
  // User-curated top 10
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Hamster_Hamster-RollAttack_y60.mp4",   caption: "Hamster — Roll Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Jaguar_Jaguar-Run_y60.mp4",            caption: "Jaguar — Run" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Eagle_Eagle-Landing_y15.mp4",          caption: "Eagle — Landing" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Dog-2_DOG-SwimIdle_y30.mp4",           caption: "Dog — Swim Idle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Horse_HorseALL-FeetUp_y30.mp4",        caption: "Horse — Feet Up" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Ostrich_Ostrich-Attack3_y60.mp4",      caption: "Ostrich — Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Chicken_Chicken-Walk_y60.mp4",         caption: "Chicken — Walk" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Leapord_Leopard-Attack_y30.mp4",       caption: "Leopard — Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Flamingo_Flamingo-BendIdle_y45.mp4",   caption: "Flamingo — Bend Idle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Goat_Goat-JumpKnock_y30.mp4",          caption: "Goat — Jump Knock" },
  // Rest, interleaved for diversity; Parrot moved to the end
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Crocodile_Crocodile-TailWhip_y60.mp4", caption: "Crocodile — Tail Whip" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Goat_Goat-Attack_y30.mp4",             caption: "Goat — Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Flamingo_Flamingo-Walk_y75.mp4",       caption: "Flamingo — Walk" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Fox_run_y60.mp4",                      caption: "Fox — Run" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Dragon_Wyvern-Attack_y30.mp4",         caption: "Wyvern — Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Jaguar_Jaguar-Sit_y75.mp4",            caption: "Jaguar — Sit" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Bird_BIRD-Attack3_y15.mp4",            caption: "Bird — Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Goat_Goat-Run_y30.mp4",                caption: "Goat — Run" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_KingCobra_Cobra-Attack_y15.mp4",       caption: "King Cobra — Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Raptor2_Raptor-Walk_y60.mp4",          caption: "Raptor — Walk" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Coyote_Coyote-Attack2_y30.mp4",        caption: "Coyote — Attack" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Pteranodon_Pteranodon-Fancy_y30.mp4",  caption: "Pteranodon — Fancy" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Lion_LionAll-Yawn_y60.mp4",            caption: "Lion — Yawn" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_zoo1010_Parrot_Parrot-CircleFly_y30.mp4",      caption: "Parrot — Circle Fly" },
];

const OBJ_CLIPS: VideoClip[] = [
  // User-curated top 6
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_6babbd9f-307b-5db5-aabc-35196095cbaa_6babbd9f-307b-5db5-aabc-35196095cbaa_y15.mp4",  caption: "Objaverse #01" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_0a763d17-417d-5473-a41a-7d1a796544d2_0a763d17-417d-5473-a41a-7d1a796544d2_y0.mp4",   caption: "Objaverse #02" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_97e2fc5c-50e4-5199-8632-99fa7160b126_97e2fc5c-50e4-5199-8632-99fa7160b126_y30.mp4",  caption: "Objaverse #03" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_1a963917-a097-5856-b445-024ebabf7a78_1a963917-a097-5856-b445-024ebabf7a78_y45.mp4",  caption: "Objaverse #04" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_22160d82-24bc-573c-922e-da11786b5ea2_22160d82-24bc-573c-922e-da11786b5ea2_y45.mp4",  caption: "Objaverse #05" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_315eddf6-32b7-53e1-8106-c270c726dca8_315eddf6-32b7-53e1-8106-c270c726dca8_y0.mp4",   caption: "Objaverse #06" },
  // Rest (original order by UUID)
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_0df893d8-8774-5cc1-ac74-8111a1c0ae08_0df893d8-8774-5cc1-ac74-8111a1c0ae08_y30.mp4",  caption: "Objaverse #07" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_2fcedbc3-d899-516b-b339-4f671945e329_2fcedbc3-d899-516b-b339-4f671945e329_y0.mp4",   caption: "Objaverse #08" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_12b981a9-d0ad-5abb-84ce-0ebffe25dd48_12b981a9-d0ad-5abb-84ce-0ebffe25dd48_y15.mp4",  caption: "Objaverse #09" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_530a6b1a-5be2-5d3d-aa68-60ca61cb0974_530a6b1a-5be2-5d3d-aa68-60ca61cb0974_y0.mp4",   caption: "Objaverse #10" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_0698819d-b40e-555d-9ef4-139bbc839933_0698819d-b40e-555d-9ef4-139bbc839933_y60.mp4",  caption: "Objaverse #11" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_obj1k_random_a6d3cfe3-ac09-5a09-b902-0baf55e5533e_a6d3cfe3-ac09-5a09-b902-0baf55e5533e_y30.mp4",  caption: "Objaverse #12" },
];

const WILD_CLIPS: VideoClip[] = [
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Eagle_Eagle_Act2.mp4",       caption: "Eagle" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Jaguar_Jaguar_Act2.mp4",     caption: "Jaguar" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Chicken_Chicken_Act2.mp4",   caption: "Chicken" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Leapord_Leapord_Act4.mp4",   caption: "Leopard" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Dog_Dog_Act2.mp4",           caption: "Dog #2" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Parrot_Parrot_Act1.mp4",     caption: "Parrot" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Bear_Bear_Act0.mp4",         caption: "Bear" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Tyranno_Tyranno_Act1.mp4",   caption: "Tyrannosaurus" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Lion_Lion_Act1.mp4",         caption: "Lion #1" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Buffalo_Buffalo-Act0.mp4",   caption: "Buffalo" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Dog_Dog_Act1.mp4",           caption: "Dog #1" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Camel_Camel-Act2.mp4",       caption: "Camel" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Coyote_Coyote_Act1.mp4",     caption: "Coyote" },
  { src: "assets/outputs_demo/mocap_demo_one2many_v2/v2/selected_nbg_wild_Lion_Lion_Act2.mp4",         caption: "Lion #2" },
];

const OneToManySection: FC = () => (
  <section id="one2many" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">3. Retarget Anything Gallery</h2>
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
  // User-curated top 9
  { src: "assets/outputs_demo/dance_demo_v3/v3/eva_jiesuan.mp4",    caption: "Eva Jiesuan" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/wulin2.mp4",         caption: "Wulin 2" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/trap.mp4",           caption: "Trap" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/gt.mp4",             caption: "GT" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/Little_Apple.mp4",   caption: "Little Apple" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/gufeng3.mp4",        caption: "Gufeng 3" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/kunkun_cut.mp4",     caption: "Kunkun" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/meow12.mp4",         caption: "Meow 12" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/Subject_3.mp4",      caption: "Subject 3" },
  // Middle block — user-specified 7 clips
  { src: "assets/outputs_demo/dance_demo_v3/v3/gufeng1.mp4",        caption: "Gufeng 1" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/wulin3.mp4",         caption: "Wulin 3" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/n2.mp4",             caption: "N2" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/gufeng2.mp4",        caption: "Gufeng 2" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/n3.mp4",             caption: "N3" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/gufeng4.mp4",        caption: "Gufeng 4" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/wulin5.mp4",         caption: "Wulin 5" },
  // Rest, interleaved so series members don't cluster
  { src: "assets/outputs_demo/dance_demo_v3/v3/n1.mp4",             caption: "N1" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/wulin1.mp4",         caption: "Wulin 1" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/x1.mp4",             caption: "X1" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/wulin4.mp4",         caption: "Wulin 4" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/x2.mp4",             caption: "X2" },
  { src: "assets/outputs_demo/dance_demo_v3/v3/x3.mp4",             caption: "X3" },
];

const DanceSection: FC = () => (
  <section id="dance" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">2. Dance Anything Gallery</h2>
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

const BIBTEX = `@article{gong2026mocapanythingv2,
  title   = {MoCapAnything V2: End-to-End Motion Capture for Arbitrary Skeletons},
  author  = {Gong, Kehong and Wen, Zhengyu and Phong, Dao Thien and
             Xu, Mingxi and He, Weixia and Wang, Qi and Zhang, Ning and
             Li, Zhengyu and Hou, Guanli and Lian, Dongze and He, Xiaoyu and
             Zhang, Mingyuan and Zhang, Hanwang},
  journal = {arXiv preprint arXiv:xxxx.xxxxx},
  year    = {2026}
}`;

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
// AcknowledgementSection
// ---------------------------------------------------------------------------

const AcknowledgementSection: FC = () => (
  <section className="section">
    <div className="container has-text-centered">
      <h2 className="title is-4">Acknowledgement</h2>
      <p className="friendly-desc" style={{ textAlign: "center", width: "70%", marginTop: 15 }}>
        We referred to the project page of{" "}
        <a href="https://nerfies.github.io/" target="_blank" rel="noopener noreferrer">Nerfies</a>
        {" "}when creating this project page.
      </p>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <div className="wrapper" style={{ width: "80%" }}>
      <SideNav />
      <HeroSection />
      <AuthorsSection />
      <StickyNav />
      <TeaserVideoSection />
      <AbstractSection />
      <MethodSection />
      <DemoSection />
      <DanceSection />
      <OneToManySection />
      <PerAnimalSection />
      <CitationSection />
      <AcknowledgementSection />
    </div>
  );
}