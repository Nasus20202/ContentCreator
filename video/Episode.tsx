import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { RenderProps, Scene } from '../src/core/schemas';
import { sceneStarts } from '../src/core/timing';
import { AccentProvider } from './accent';
import { Badge, Captions, Chip, TitleOverlay } from './components/overlays';
import { SceneContext, useSceneTime } from './scene-context';
import { Orbit3DScene } from './scenes/Orbit3DScene';
import { FactCardScene, ImageScene, OutroScene } from './scenes/simple-scenes';
import { ScaleScene } from './scenes/ScaleScene';
import { CompareScene } from './scenes/CompareScene';
import { SkyViewScene } from './scenes/SkyViewScene';
import { theme } from './theme';
import { BED_LIFT, musicDuck, speechWindows } from './duck';

const Template: React.FC<{ scene: Scene }> = ({ scene }) => {
  switch (scene.template) {
    case 'skyView':
      return <SkyViewScene sceneId={scene.id} params={scene.params} />;
    case 'orbit3d':
      return <Orbit3DScene sceneId={scene.id} params={scene.params} />;
    case 'factCard':
      return <FactCardScene sceneId={scene.id} params={scene.params} />;
    case 'scale':
      return <ScaleScene params={scene.params} />;
    case 'compare':
      return <CompareScene params={scene.params} />;
    case 'image':
      return <ImageScene params={scene.params} />;
    case 'outro':
      return <OutroScene sceneId={scene.id} params={scene.params} />;
  }
};

const SceneOverlays: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { win, timeline } = useSceneTime();
  return (
    <>
      {scene.title && (
        <TitleOverlay
          kicker={scene.title.kicker}
          title={scene.title.title}
          opacity={win(scene.title.from, scene.title.to)}
        />
      )}
      {scene.chips.map((c, i) => (
        <Chip key={i} text={c.text} opacity={win(c.from, c.to)} />
      ))}
      {scene.captions && <Captions sentences={timeline.sentences} />}
    </>
  );
};

const SceneShell: React.FC<{ scene: Scene; props: RenderProps; index: number; frames: number; fps: number }> = ({
  scene,
  props,
  index,
  frames,
  fps,
}) => {
  const frame = useCurrentFrame();
  const timeline = props.timeline.scenes[index];
  return (
    <SceneContext.Provider value={{ timeline, props, durationSec: frames / fps }}>
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
          // Each scene settles in from a slight zoom, so cuts feel like camera moves, not slides.
          transform: `scale(${interpolate(frame, [0, 14], [1.05, 1], { extrapolateRight: 'clamp' })})`,
        }}
      >
        <Template scene={scene} />
        <SceneOverlays scene={scene} />
        <Audio src={staticFile(timeline.audioFile)} />
      </AbsoluteFill>
    </SceneContext.Provider>
  );
};

export const Episode: React.FC<RenderProps> = (props) => {
  const { plan, timeline, fps } = props;
  const starts = sceneStarts(timeline, fps);
  const total = starts.reduce((n, s) => n + s.frames, 0);
  const speech = speechWindows(timeline, fps);
  const firstEnd = starts[0]?.frames ?? 0;
  return (
    <AccentProvider accent={props.accent}>
      <AbsoluteFill style={{ background: theme.bg }}>
        {plan.scenes.map((scene, i) => (
          <Sequence key={scene.id} from={starts[i].from} durationInFrames={starts[i].frames} name={scene.id}>
            <SceneShell scene={scene} props={props} index={i} frames={starts[i].frames} fps={fps} />
          </Sequence>
        ))}
        <Sequence from={Math.max(0, firstEnd - 10)} durationInFrames={Math.max(1, total - firstEnd + 10)} name="badge">
          <Badge text={plan.badge} />
        </Sequence>
        {props.musicFile && plan.music.enabled && (
          <Audio
            src={staticFile(props.musicFile)}
            volume={(f) =>
              interpolate(f, [0, 30], [0, plan.music.volume * BED_LIFT], { extrapolateRight: 'clamp' }) *
              musicDuck(f, speech, fps)
            }
          />
        )}
      </AbsoluteFill>
    </AccentProvider>
  );
};
