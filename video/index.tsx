import React from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import type { RenderProps } from '../src/core/schemas';
import { totalFrames } from '../src/core/timing';
import { Episode } from './Episode';

const Empty: React.FC = () => (
  <AbsoluteFill
    style={{
      background: '#000',
      color: '#fff',
      fontSize: 48,
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      padding: 80,
    }}
  >
    No episode props. Open the studio with: pnpm studio -- --props episodes/&lt;id&gt;/build/render-props.json
    --public-dir episodes/&lt;id&gt;/build
  </AbsoluteFill>
);

const Component: React.FC<RenderProps> = (props) => (props.plan ? <Episode {...props} /> : <Empty />);

const Root: React.FC = () => (
  <Composition
    id="Episode"
    component={Component}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={{} as RenderProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.timeline ? totalFrames(props.timeline, props.fps) : 300,
      fps: props.fps ?? 30,
    })}
  />
);

registerRoot(Root);
