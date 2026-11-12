/**
 * Single source of truth for every file the pipeline reads or writes.
 * Both the Node pipeline and the Remotion bundle import these types.
 */
import { z } from 'zod';

export const Actor = z.enum(['pipeline', 'claude', 'human']);
export type Actor = z.infer<typeof Actor>;

export const STAGES = [
  'created',
  'researched',
  'planned',
  'factchecked',
  'voiced',
  'rendered',
  'qa-passed',
  'approved',
  'published',
] as const;
export const Stage = z.enum(STAGES);
export type Stage = z.infer<typeof Stage>;

// ---------------------------------------------------------------- location

export const Location = z.object({
  id: z.string(),
  label: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timeZone: z.string(),
});
export type Location = z.infer<typeof Location>;

// ---------------------------------------------------------------- facts

export const FactSource = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('computed'),
    method: z.string(),
    inputs: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('url'),
    url: z.url(),
    title: z.string(),
    publisher: z.string().optional(),
    accessed: z.iso.date(),
  }),
]);
export type FactSource = z.infer<typeof FactSource>;

/** A verifiable statement. Every claim in a plan must point at one or more facts. */
export const Fact = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  statement: z.string(),
  /** Numeric values a narration may legitimately quote (approximations are checked with tolerance). */
  values: z.array(z.number()).default([]),
  source: FactSource,
});
export type Fact = z.infer<typeof Fact>;

export const FactsFile = z.object({ facts: z.array(Fact) });
export type FactsFile = z.infer<typeof FactsFile>;

// ---------------------------------------------------------------- research (sky events)

export const SkyEvent = z.object({
  id: z.string(),
  kind: z.enum([
    'conjunction',
    'moon-pass',
    'meteor-shower',
    'moon-phase',
    'opposition',
    'elongation',
    'lunar-eclipse',
    'solar-eclipse',
    'planet-visibility',
  ]),
  title: z.string(),
  /** UTC instant of the event peak / best moment. */
  time: z.iso.datetime(),
  /** 0..100, higher = more worth featuring. Heuristic; Claude makes the final call. */
  score: z.number(),
  bodies: z.array(z.string()),
  viewing: z
    .object({
      bestLocal: z.string(),
      bestUtc: z.iso.datetime(),
      azimuth: z.number(),
      altitude: z.number(),
      direction: z.string(),
    })
    .optional(),
  factIds: z.array(z.string()),
  notes: z.array(z.string()).default([]),
});
export type SkyEvent = z.infer<typeof SkyEvent>;

export const ResearchFile = z.object({
  kind: z.literal('sky-week'),
  location: Location,
  window: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }),
  generatedAt: z.iso.datetime(),
  engine: z.string(),
  events: z.array(SkyEvent),
});
export type ResearchFile = z.infer<typeof ResearchFile>;

// ---------------------------------------------------------------- plan

/** A time inside a scene: seconds from scene start, or anchored to a narration sentence. */
export const TimeRef = z.union([
  z.number().min(0),
  z.object({
    sentence: z.number().int().min(0),
    edge: z.enum(['start', 'end']).default('start'),
    offset: z.number().default(0),
  }),
]);
export type TimeRef = z.infer<typeof TimeRef>;

export const SkyTarget = z.union([
  z.object({ body: z.string() }),
  z.object({ midpoint: z.tuple([z.string(), z.string()]) }),
  z.object({ azAlt: z.tuple([z.number(), z.number().min(-10).max(90)]) }),
  z.object({ radiant: z.literal(true) }),
]);
export type SkyTarget = z.infer<typeof SkyTarget>;

export const CameraKey = z.object({
  at: TimeRef,
  target: SkyTarget,
  /** Horizontal field of view in degrees. */
  fov: z.number().min(1).max(160),
  dAz: z.number().default(0),
  dAlt: z.number().default(0),
});
export type CameraKey = z.infer<typeof CameraKey>;

const Window = { from: TimeRef.default(0), to: TimeRef.optional() };

export const Chip = z.object({ text: z.string().max(48), ...Window });
export type Chip = z.infer<typeof Chip>;

export const TitleOverlay = z.object({ kicker: z.string(), title: z.string(), ...Window });
export type TitleOverlay = z.infer<typeof TitleOverlay>;

export const SkyViewParams = z.object({
  /** UTC instant the sky is drawn for. */
  time: z.iso.datetime(),
  bodies: z.array(z.string()).min(0),
  /** Meteor shower radiant, J2000 degrees. */
  radiant: z.object({ ra: z.number(), dec: z.number() }).optional(),
  camera: z.array(CameraKey).min(1),
  labels: z
    .array(
      z.object({
        body: z.string(),
        text: z.string(),
        sub: z.string().optional(),
        side: z.enum(['left', 'right']).default('right'),
        ...Window,
      }),
    )
    .default([]),
  starLabels: z.array(z.object({ name: z.string(), ...Window })).default([]),
  separation: z.object({ a: z.string(), b: z.string(), text: z.string(), ...Window }).optional(),
  moonCompare: z.object({ a: z.string(), b: z.string(), count: z.number().int().min(1).max(6), ...Window }).optional(),
  constellation: z.object({ id: z.string(), label: z.string(), ...Window }).optional(),
  meteors: z.object({ perSecond: z.number().min(0).max(5).default(1.2), ...Window }).optional(),
  twilight: z.number().min(0).max(1).default(0.3),
  constellationLines: z.number().min(0).max(1).default(0.08),
});
export type SkyViewParams = z.infer<typeof SkyViewParams>;

export const Orbit3DParams = z.object({
  time: z.iso.datetime(),
  bodies: z.array(z.enum(['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn'])).min(2),
  /** Draw Earth's line of sight toward `to`, passing near `through`. */
  lineOfSight: z.object({ to: z.string(), through: z.string().optional() }).optional(),
  /** When the camera swings from Earth's point of view to the top-down reveal. */
  revealAt: TimeRef,
  distancesAt: TimeRef.optional(),
});
export type Orbit3DParams = z.infer<typeof Orbit3DParams>;

export const FactCardParams = z.object({
  value: z.string().max(16),
  label: z.string().max(60),
  sourceLine: z.string().max(80).optional(),
});
export type FactCardParams = z.infer<typeof FactCardParams>;

/**
 * A vertical distance bar from the top (0) to the bottom (`total`). Markers are placed linearly, so a
 * tiny distance shows as a point at the start: that is the point of the picture.
 */
export const ScaleParams = z.object({
  total: z.number().positive(),
  /** Label of the far end, e.g. "4.24 light-years". */
  totalLabel: z.string().max(40),
  markers: z
    .array(z.object({ at: z.number().min(0), label: z.string().max(40) }))
    .min(1)
    .max(4),
});
export type ScaleParams = z.infer<typeof ScaleParams>;

/**
 * Horizontal bars with a shared unit, drawn to scale (linear) or on a log scale for values that span
 * orders of magnitude. On a log scale every value must be at least 1, so the bars start from 1.
 */
export const CompareParams = z.object({
  heading: z.string().max(50).optional(),
  scale: z.enum(['linear', 'log']).default('linear'),
  bars: z
    .array(z.object({ label: z.string().max(40), value: z.number().min(1), display: z.string().max(20) }))
    .min(2)
    .max(3),
  note: z.string().max(80).optional(),
});
export type CompareParams = z.infer<typeof CompareParams>;

/**
 * A trip drawn to scale: bodies along a track (`at` in one unit, linear), a traveller (light or a
 * ship) moving along `path` (stop indices, e.g. [0, 1, 0] for there and back) at constant speed for
 * light, accelerating and braking for a ship, and up to two clocks counting from `from` to `to`
 * while it travels. Only the start and end readings are claims (fact-checked); readings in between
 * are animation.
 */
export const JourneyStop = z.object({
  name: z.string().max(30),
  at: z.number().min(0),
  kind: z.enum(['sun', 'earth', 'mars', 'jupiter', 'star', 'blackhole', 'galaxy', 'point']),
  /** Small line under the name, e.g. "1 AU". */
  sub: z.string().max(30).optional(),
  /** Shown when the traveller arrives, e.g. "8 min 20 s". */
  arrive: z.string().max(24).optional(),
});
export const JourneyClock = z.object({
  label: z.string().max(20),
  from: z.number().min(0).default(0),
  to: z.number().min(0),
  unit: z.enum(['min', 's', 'years']),
  /** Decimal places for years below a million (4.24 light-years at nearly light speed → "4.24 yrs"). */
  decimals: z.number().int().min(0).max(2).default(0),
});
export const JourneyParams = z.object({
  traveller: z.enum(['light', 'ship']),
  stops: z.array(JourneyStop).min(2).max(4),
  path: z.array(z.number().int().min(0)).min(2).max(4),
  /** When the traveller sets off, and how many seconds of screen time the whole path takes. */
  start: TimeRef.default(0.6),
  travel: z.number().positive().max(20).default(3),
  clocks: z.array(JourneyClock).max(2).default([]),
  /**
   * Optional real photo of where the trip goes (a `cc asset`), shown behind the diagram and growing
   * brighter and closer as the traveller approaches; `label` says what it is, the credit is added.
   */
  backdrop: z.object({ assetId: z.string(), label: z.string().max(44) }).optional(),
});
export type JourneyParams = z.infer<typeof JourneyParams>;

/** Light (or anything) circling a body in slow motion, with a lap counter: "7.5 times around Earth". */
export const LapsParams = z.object({
  body: z.enum(['earth', 'moon']),
  /** Optional real photo of the body (a centred full disc, e.g. Apollo 17's Blue Marble); credited on screen. */
  assetId: z.string().optional(),
  /** Fraction of the image width the disc fills, and the disc centre (0..1), to crop the photo to the disc. */
  disc: z
    .object({ size: z.number().min(0.1).max(1), cx: z.number().min(0).max(1), cy: z.number().min(0).max(1) })
    .default({ size: 0.667, cx: 0.5, cy: 0.508 }),
  laps: z.number().positive().max(50),
  label: z.string().max(40),
  note: z.string().max(50).optional(),
  start: TimeRef.default(0.3),
  /** Seconds of screen time the counted laps take (the slow-motion factor follows from it). */
  over: z.number().positive().max(15).default(4),
});
export type LapsParams = z.infer<typeof LapsParams>;

export const ImageParams = z.object({
  assetId: z.string(),
  zoom: z.tuple([z.number().min(1), z.number().min(1)]).default([1.0, 1.12]),
  focus: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).default([0.5, 0.5]),
  /** "cover" fills the frame (crops), "contain" shows the whole image as a centred band. */
  fit: z.enum(['cover', 'contain']).default('cover'),
  /**
   * A ring and label on the focus point ("cover" only: the focus pixel stays at the same place on
   * screen while zooming, so the ring stays on target), e.g. Earth in the Pale Blue Dot.
   */
  marker: z.object({ label: z.string().max(30), from: TimeRef.default(0.5) }).optional(),
});
export type ImageParams = z.infer<typeof ImageParams>;

export const OutroParams = z.object({
  kicker: z.string(),
  cta: z.string(),
  footnote: z.string().optional(),
  /** Optional sky backdrop. */
  sky: SkyViewParams.pick({ time: true, bodies: true, camera: true }).optional(),
});
export type OutroParams = z.infer<typeof OutroParams>;

const SceneBase = {
  id: z.string().regex(/^[a-z0-9][a-zA-Z0-9-]*$/),
  /** One string per spoken sentence. Sentences are the unit of timing. */
  narration: z.array(z.string().min(1)).min(1),
  /** Facts that back every claim (spoken or on-screen) made in this scene. */
  factIds: z.array(z.string()).default([]),
  chips: z.array(Chip).default([]),
  title: TitleOverlay.optional(),
  captions: z.boolean().default(true),
};

export const Scene = z.discriminatedUnion('template', [
  z.object({ ...SceneBase, template: z.literal('skyView'), params: SkyViewParams }),
  z.object({ ...SceneBase, template: z.literal('orbit3d'), params: Orbit3DParams }),
  z.object({ ...SceneBase, template: z.literal('factCard'), params: FactCardParams }),
  z.object({ ...SceneBase, template: z.literal('scale'), params: ScaleParams }),
  z.object({ ...SceneBase, template: z.literal('compare'), params: CompareParams }),
  z.object({ ...SceneBase, template: z.literal('image'), params: ImageParams }),
  z.object({ ...SceneBase, template: z.literal('journey'), params: JourneyParams }),
  z.object({ ...SceneBase, template: z.literal('laps'), params: LapsParams }),
  z.object({ ...SceneBase, template: z.literal('outro'), params: OutroParams }),
]);
export type Scene = z.infer<typeof Scene>;
export type SceneTemplate = Scene['template'];

export const Platform = z.enum(['youtube', 'tiktok', 'instagram', 'facebook']);
export type Platform = z.infer<typeof Platform>;

export const Plan = z.object({
  episodeId: z.string(),
  series: z.string(),
  /** Internal working title. */
  title: z.string(),
  badge: z.string().max(40),
  location: Location.optional(),
  voice: z.object({ id: z.string(), speed: z.number().min(0.7).max(1.4).default(1.05) }),
  music: z.object({
    enabled: z.boolean().default(true),
    /** Multiplier on the synthesised bed. 0.14-0.15 sits ~11 LU under the voice. */
    volume: z.number().min(0).max(1).default(0.15),
    /**
     * Bed character; see RECIPE in src/render/media.ts. Optional rather than defaulted so adding it
     * does not change the plan hash of episodes that predate it.
     */
    style: z.enum(['piano', 'piano-pulse', 'piano-air', 'orbit', 'nebula', 'meteor']).optional(),
    /** Bed variant: timing/velocity seed and transposition in semitones. Optional, same reason as style. */
    seed: z.number().int().min(0).max(999).optional(),
    transpose: z.number().int().min(-6).max(6).optional(),
  }),
  scenes: z.array(Scene).min(2),
  post: z.object({
    /** Platform-facing title (YouTube title, TikTok title). */
    title: z.string().min(2).max(90),
    description: z.string().max(2000),
    hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(8),
  }),
});
export type Plan = z.infer<typeof Plan>;

// ---------------------------------------------------------------- voice timeline

export const Word = z.object({ w: z.string(), start: z.number(), end: z.number() });
export const Sentence = z.object({ text: z.string(), start: z.number(), end: z.number(), words: z.array(Word) });
export type Sentence = z.infer<typeof Sentence>;
export const SceneTimeline = z.object({
  sceneId: z.string(),
  audioFile: z.string(),
  duration: z.number(),
  sentences: z.array(Sentence),
});
export type SceneTimeline = z.infer<typeof SceneTimeline>;
export const Timeline = z.object({
  engine: z.string(),
  voice: z.string(),
  narrationHash: z.string(),
  timing: z.literal('estimated-proportional'),
  scenes: z.array(SceneTimeline),
});
export type Timeline = z.infer<typeof Timeline>;

// ---------------------------------------------------------------- assets

export const AssetRecord = z.object({
  id: z.string(),
  kind: z.enum(['image', 'video']),
  file: z.string(),
  sha256: z.string(),
  source: z.object({
    provider: z.enum(['nasa-images', 'esa', 'wikimedia', 'own']),
    url: z.url(),
    pageUrl: z.url().optional(),
    title: z.string(),
    credit: z.string(),
    license: z.string(),
  }),
  aiGenerated: z.boolean().default(false),
  addedAt: z.iso.datetime(),
});
export type AssetRecord = z.infer<typeof AssetRecord>;
export const AssetsFile = z.object({ assets: z.array(AssetRecord) });
export type AssetsFile = z.infer<typeof AssetsFile>;

// ---------------------------------------------------------------- manifest & trace

export const Manifest = z.object({
  id: z.string(),
  series: z.string(),
  createdAt: z.iso.datetime(),
  stage: Stage,
  location: Location.optional(),
  window: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).optional(),
  /** Hashes of the inputs each stage consumed, so stale outputs are detected. */
  hashes: z.record(z.string(), z.string()).default({}),
  approvals: z
    .array(
      z.object({
        by: z.string(),
        actor: Actor,
        at: z.iso.datetime(),
        videoSha256: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),
});
export type Manifest = z.infer<typeof Manifest>;

export const LogEntry = z.object({
  ts: z.iso.datetime(),
  actor: Actor,
  stage: z.string(),
  action: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
  gitSha: z.string().optional(),
});
export type LogEntry = z.infer<typeof LogEntry>;

export const Decision = z.object({
  ts: z.iso.datetime(),
  actor: Actor,
  stage: z.string(),
  decision: z.string().min(3),
  rationale: z.string().min(3),
  alternatives: z.array(z.string()).default([]),
  inputs: z.array(z.string()).default([]),
});
export type Decision = z.infer<typeof Decision>;

// ---------------------------------------------------------------- render / qa / publish / metrics

export const RenderRecord = z.object({
  renderedAt: z.iso.datetime(),
  planHash: z.string(),
  timelineHash: z.string(),
  videoFile: z.string(),
  videoSha256: z.string(),
  durationSec: z.number(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  renderSeconds: z.number(),
  remotionVersion: z.string(),
});
export type RenderRecord = z.infer<typeof RenderRecord>;

export const QaCheck = z.object({ name: z.string(), ok: z.boolean(), detail: z.string() });
export const QaRecord = z.object({
  checkedAt: z.iso.datetime(),
  videoSha256: z.string(),
  automated: z.array(QaCheck),
  frames: z.array(z.object({ file: z.string(), sceneId: z.string(), tSec: z.number() })),
  visualReview: z
    .object({ actor: Actor, at: z.iso.datetime(), verdict: z.enum(['pass', 'fail']), notes: z.string() })
    .optional(),
});
export type QaRecord = z.infer<typeof QaRecord>;

export const PublishTarget = z.object({
  platform: Platform,
  /** Channel id in the publishing provider (Buffer channel id). */
  channelId: z.string(),
  status: z.enum(['dry-run', 'submitted', 'failed']),
  /** Post id returned by the provider. */
  postId: z.string().optional(),
  error: z.string().optional(),
  payload: z.unknown(),
});
export const PublishRecord = z.object({
  attempts: z.array(
    z.object({
      at: z.iso.datetime(),
      actor: Actor,
      /** `reschedule` moves the posts of the previous submission (payload = { postId, dueAt }). */
      mode: z.enum(['now', 'schedule', 'draft', 'reschedule']),
      scheduledFor: z.iso.datetime().optional(),
      dryRun: z.boolean(),
      provider: z.literal('buffer'),
      endpoint: z.string(),
      videoSha256: z.string(),
      /** Public URL the provider fetches the video from. */
      media: z.object({ url: z.string() }).optional(),
      targets: z.array(PublishTarget),
    }),
  ),
});
export type PublishRecord = z.infer<typeof PublishRecord>;

export const MetricSnapshot = z.object({
  at: z.iso.datetime(),
  platform: Platform,
  url: z.string().optional(),
  views: z.number().int().min(0),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  avgViewPct: z.number().min(0).max(100).optional(),
  followersGained: z.number().int().optional(),
  source: z.string(),
});
export type MetricSnapshot = z.infer<typeof MetricSnapshot>;

// ---------------------------------------------------------------- config

export const ChannelConfig = z.object({
  name: z.string(),
  defaultLocation: z.string(),
  locations: z.array(Location),
  voice: z.object({ id: z.string(), speed: z.number() }),
  /** Never auto-approve unless the human explicitly flips this. */
  autoApprove: z.boolean().default(false),
  publishing: z.object({
    defaultMode: z.enum(['now', 'schedule', 'draft']).default('draft'),
    aiDisclosure: z.boolean().default(true),
    provider: z.literal('buffer').default('buffer'),
    /** Buffer fetches media by URL: approved videos are committed to an orphan branch of this public repo. */
    mediaHost: z.object({
      type: z.literal('git-branch'),
      repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
      branch: z.string().default('videos'),
    }),
    targets: z.array(z.object({ platform: Platform, channelId: z.string(), enabled: z.boolean().default(true) })),
  }),
});
export type ChannelConfig = z.infer<typeof ChannelConfig>;

// ---------------------------------------------------------------- render props (Node → Remotion)

export type Vec3 = [number, number, number];

export const SkySnapshot = z.object({
  time: z.string(),
  /** [x=north, y=west, z=up, mag, bv] */
  stars: z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()])),
  lines: z.array(z.object({ c: z.string(), p: z.array(z.tuple([z.number(), z.number(), z.number()])) })),
  starNames: z.array(z.object({ name: z.string(), v: z.tuple([z.number(), z.number(), z.number()]) })),
  bodies: z.array(
    z.object({
      name: z.string(),
      v: z.tuple([z.number(), z.number(), z.number()]),
      mag: z.number(),
      phase: z.number(),
      distAu: z.number(),
    }),
  ),
  sun: z.tuple([z.number(), z.number(), z.number()]),
  radiant: z.tuple([z.number(), z.number(), z.number()]).optional(),
});
export type SkySnapshot = z.infer<typeof SkySnapshot>;

export const OrbitSnapshot = z.object({
  bodies: z.array(
    z.object({ name: z.string(), xy: z.tuple([z.number(), z.number()]), r: z.number(), distKm: z.number() }),
  ),
});
export type OrbitSnapshot = z.infer<typeof OrbitSnapshot>;

export const RenderProps = z.object({
  plan: Plan,
  timeline: Timeline,
  sky: z.record(z.string(), SkySnapshot),
  orbits: z.record(z.string(), OrbitSnapshot),
  assets: z.record(z.string(), z.object({ file: z.string(), credit: z.string() })),
  musicFile: z.string().optional(),
  /** Series accent, so every template draws the same colour without importing the theme map. */
  accent: z.object({ hex: z.string(), rgb: z.string() }),
  fps: z.number(),
});
export type RenderProps = z.infer<typeof RenderProps>;
