import React from 'react';
import { AbsoluteFill, Composition, registerRoot, Still } from 'remotion';
import type { RenderProps } from '../src/core/schemas';
import { totalFrames } from '../src/core/timing';
import { Banner, Logo } from './brand/Brand';
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
  <>
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
    <Still id="Logo" component={Logo} width={800} height={800} />
    <Still id="Banner" component={Banner} width={2560} height={1440} />
  </>
);

registerRoot(Root);
